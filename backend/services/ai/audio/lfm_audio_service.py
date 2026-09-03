import os
import sys
import io
import json
import base64
import asyncio
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Automatically load environment variables from backend/.env or root .env
try:
    from dotenv import load_dotenv
    candidates = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"),
        os.path.join(os.getcwd(), "backend", ".env"),
        os.path.join(os.getcwd(), ".env"),
    ]
    for c in candidates:
        if os.path.exists(c):
            load_dotenv(dotenv_path=c)
            break
except ImportError:
    pass

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware

# Configure clean logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [LFM-Audio] %(message)s"
)
logger = logging.getLogger("lfm_audio_service")

# Global state for loaded model and processor
model_state: Dict[str, Any] = {
    "model": None,
    "processor": None,
    "status": "uninitialized",
    "device": "cpu",
    "dtype": "float32",
    "error": None,
    "model_name": os.environ.get("LFM_AUDIO_MODEL", "LiquidAI/LFM2.5-Audio-1.5B"),
    "sampling_rate": 24000,
    "is_mock": False,
}

SUPPORTED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".aac"}
SUPPORTED_AUDIO_MIMES = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp3",
    "audio/m4a", "audio/x-m4a", "audio/mp4",
    "audio/ogg", "audio/vorbis",
    "audio/flac", "audio/x-flac",
    "audio/webm",
    "audio/aac", "audio/x-aac",
}
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


def get_optimal_device():
    """
    Detects available hardware. Automatically selects CUDA if an NVIDIA GPU is found;
    otherwise falls back to CPU for Intel Iris Xe / standard CPU.
    """
    try:
        # pyrefly: ignore [missing-import]
        import torch
        if torch.cuda.is_available():
            logger.info("⚡ CUDA detected. Using GPU for LFM Audio inference.")
            return "cuda", torch.bfloat16
    except Exception as e:
        logger.warning(f"Could not check CUDA availability: {e}")
    
    logger.info("🖥️ CUDA not available. Using CPU inference (float32).")
    try:
        # pyrefly: ignore [missing-import]
        import torch
        return "cpu", torch.float32
    except ImportError:
        return "cpu", "float32"


def patch_processor_for_device():
    """
    Ensures liquid_audio LFM2AudioProcessor supports CPU execution properly
    by using the configured device instead of hardcoded .cuda().
    """
    try:
        import liquid_audio.processor
        from pathlib import Path
        from safetensors.torch import load_file
        from liquid_audio.detokenizer import LFM2AudioDetokenizer
        from transformers.models.lfm2 import Lfm2Config

        def safe_audio_detokenizer(self):
            if self.detokenizer_path is None:
                msg = f"model {self.name} does not provide LFM based audio detokenizer."
                raise AttributeError(msg)

            if self._audio_detokenizer is None:
                detok_config_path = Path(self.detokenizer_path) / "config.json"
                detok_config = Lfm2Config.from_pretrained(detok_config_path)

                def rename_layer(layer):
                    if layer in ("conv", "full_attention"):
                        return layer
                    if layer == "sliding_attention":
                        return "full_attention"
                    return layer

                if isinstance(detok_config.layer_types, list):
                    detok_config.layer_types = [rename_layer(l) for l in detok_config.layer_types]

                detok = LFM2AudioDetokenizer(detok_config).eval().to(self.device)

                detok_weights_path = Path(self.detokenizer_path) / "model.safetensors"
                detok_weights = load_file(str(detok_weights_path), device=str(self.device))
                detok.load_state_dict(detok_weights)
                detok.eval()

                self._audio_detokenizer = detok

            return self._audio_detokenizer

        liquid_audio.processor.LFM2AudioProcessor.audio_detokenizer = property(safe_audio_detokenizer)
        logger.info("Configured LFM2AudioProcessor device-aware audio detokenizer.")
    except Exception as patch_err:
        logger.warning(f"Could not apply device-aware patch to processor: {patch_err}")


def load_model_and_processor():
    """
    Loads the real LiquidAI LFM2.5-Audio-1.5B model and processor into memory once.
    Strictly uses real model weights without mock fallbacks.
    """
    global model_state
    model_name = os.environ.get("LFM_AUDIO_MODEL", "LiquidAI/LFM2.5-Audio-1.5B")
    hf_token = os.environ.get("HF_TOKEN") or None
    model_state["model_name"] = model_name
    model_state["status"] = "loading"
    model_state["is_mock"] = False
    model_state["error"] = None

    device, dtype = get_optimal_device()
    model_state["device"] = device
    model_state["dtype"] = str(dtype)

    logger.info(f"Loading real foundation model '{model_name}' onto {device} ({dtype})...")

    try:
        patch_processor_for_device()

        # pyrefly: ignore [missing-import]
        from liquid_audio import LFM2AudioModel, LFM2AudioProcessor

        if hf_token and hf_token.strip():
            os.environ["HF_TOKEN"] = hf_token.strip()
            os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token.strip()

        logger.info(f"Downloading/loading LFM2AudioProcessor for {model_name} on {device}...")
        # Note: trust_remote_code is not supported and not passed to LFM2AudioProcessor.from_pretrained
        processor = LFM2AudioProcessor.from_pretrained(model_name, device=device)

        logger.info(f"Downloading/loading LFM2AudioModel weights for {model_name} on {device} ({dtype})...")
        model = LFM2AudioModel.from_pretrained(
            model_name,
            device=device,
            dtype=dtype,
        )

        model_state["model"] = model
        model_state["processor"] = processor
        model_state["status"] = "ready"
        model_state["is_mock"] = False
        model_state["error"] = None
        logger.info(f"✅ Real {model_name} successfully loaded into memory and ready on {device}.")

    except Exception as e:
        model_state["status"] = "error"
        model_state["model"] = None
        model_state["processor"] = None
        model_state["is_mock"] = False
        model_state["error"] = str(e)
        logger.error(f"❌ Failed to load real {model_name}: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize model on startup
    load_model_and_processor()
    yield
    # Cleanup on shutdown
    model_state["model"] = None
    model_state["processor"] = None


app = FastAPI(
    title="AI Tutor - LiquidAI LFM2.5-Audio-1.5B Microservice",
    version="1.0.0",
    description="Dedicated multimodal Audio-to-Audio / Speech-to-Speech microservice (Real Model)",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_audio_tensor(audio_bytes: bytes, target_sr: int = 24000):
    """
    Decodes audio bytes into a normalized mono PyTorch tensor at the target sample rate.
    """
    # pyrefly: ignore [missing-import]
    import torch
    # pyrefly: ignore [missing-import]
    import soundfile as sf
    # pyrefly: ignore [missing-import]
    import numpy as np

    bio = io.BytesIO(audio_bytes)
    try:
        data, sr = sf.read(bio)
    except Exception:
        # Fallback to librosa if soundfile cannot parse (e.g. mp3/m4a without libsndfile mp3 support)
        # pyrefly: ignore [missing-import]
        import librosa
        bio.seek(0)
        data, sr = librosa.load(bio, sr=target_sr, mono=True)
        return torch.from_numpy(data).float(), target_sr

    # Convert to mono if multi-channel
    if data.ndim > 1:
        data = np.mean(data, axis=1)

    # Resample if needed
    if sr != target_sr:
        # pyrefly: ignore [missing-import]
        import librosa
        data = librosa.resample(data.astype(np.float32), orig_sr=sr, target_sr=target_sr)
        sr = target_sr

    tensor = torch.from_numpy(data).float()
    return tensor, sr


@app.get("/health")
async def health_check():
    """
    Health check endpoint reporting LFM Audio microservice state and hardware detection.
    Reports ready: true ONLY when the real model is loaded in memory.
    """
    is_ready = (
        model_state["status"] == "ready"
        and model_state["model"] is not None
        and model_state["processor"] is not None
    )

    return {
        "success": is_ready,
        "service": "lfm-audio",
        "model": model_state["model_name"],
        "status": model_state["status"],
        "device": model_state["device"],
        "dtype": model_state["dtype"],
        "sampling_rate": model_state["sampling_rate"],
        "ready": is_ready,
        "is_mock_fallback": False,
        "error": model_state.get("error"),
    }


@app.get("/model-info")
async def model_info():
    """
    Returns model metadata, supported input audio formats, and generation modes.
    """
    is_ready = (
        model_state["status"] == "ready"
        and model_state["model"] is not None
        and model_state["processor"] is not None
    )

    return {
        "success": True,
        "model": model_state["model_name"],
        "architecture": "LFM2.5-Audio-1.5B (FastConformer + RQ-Transformer)",
        "capabilities": ["audio-to-audio", "speech-to-speech", "interleaved-generation"],
        "sampling_rate": model_state["sampling_rate"],
        "supported_input_formats": ["wav", "mp3", "m4a", "ogg", "flac", "webm", "aac"],
        "device": model_state["device"],
        "dtype": model_state["dtype"],
        "status": model_state["status"],
        "ready": is_ready,
        "is_mock_fallback": False,
        "error": model_state.get("error"),
    }


@app.post("/audio/chat")
async def audio_chat(
    audio: UploadFile = File(...),
    message: Optional[str] = Form(None),
    history: Optional[str] = Form("[]"),
    mode: Optional[str] = Form("explain"),
    user_level: Optional[str] = Form("beginner"),
):
    """
    Multimodal Audio-to-Audio Conversational Chat Endpoint using real LiquidAI/LFM2.5-Audio-1.5B.
    Accepts uploaded audio (wav, mp3, m4a, etc.) + optional text prompt.
    Runs real LFM2.5-Audio-1.5B inference and returns generated audio (WAV base64) & transcript.
    """
    if model_state["status"] != "ready" or model_state["model"] is None or model_state["processor"] is None:
        err_msg = model_state.get("error") or f"Model is currently in state '{model_state['status']}'."
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"LFM Audio model '{model_state['model_name']}' is not ready. Reason: {err_msg}",
        )

    # 1. Validate file existence and filename
    if not audio or not audio.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An audio file is required for audio chat.",
        )

    ext = os.path.splitext(audio.filename)[1].lower()
    if ext not in SUPPORTED_AUDIO_EXTENSIONS and (audio.content_type or "") not in SUPPORTED_AUDIO_MIMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio format: '{ext}'. Supported formats: {', '.join(SUPPORTED_AUDIO_EXTENSIONS)}",
        )

    # 2. Read and validate audio bytes
    try:
        audio_bytes = await audio.read()
        if len(audio_bytes) == 0:
            raise ValueError("Uploaded audio file is empty.")
        if len(audio_bytes) > MAX_AUDIO_SIZE_BYTES:
            raise ValueError(f"Audio file exceeds maximum size limit of {MAX_AUDIO_SIZE_BYTES // (1024 * 1024)}MB.")
    except Exception as e:
        logger.warning(f"Failed to read uploaded audio: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid audio upload: {str(e)}",
        )

    # 3. Preprocess audio into tensor
    try:
        wav_tensor, sr = load_audio_tensor(audio_bytes, target_sr=model_state["sampling_rate"])
        duration_sec = float(len(wav_tensor) / sr)
        logger.info(f"Loaded input audio: duration={duration_sec:.2f}s, sample_rate={sr}Hz")
    except Exception as proc_err:
        logger.error(f"Error processing audio waveform: {proc_err}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not decode the provided audio. Please provide a standard WAV, MP3, M4A, or OGG file.",
        )

    # 4. Parse conversation history
    parsed_history = []
    if history:
        try:
            parsed_history = json.loads(history)
        except Exception:
            parsed_history = []

    # 5. Execute Real LFM Audio Model Inference in worker thread
    def _execute_lfm_inference():
        # pyrefly: ignore [missing-import]
        import torch
        # pyrefly: ignore [missing-import]
        import soundfile as sf
        # pyrefly: ignore [missing-import]
        from liquid_audio import ChatState

        model = model_state["model"]
        processor = model_state["processor"]

        chat = ChatState(processor)
        
        # System prompt setup
        chat.new_turn("system")
        system_instruction = (
            f"You are an expert, encouraging AI Tutor. The student is at a '{user_level}' level. "
            "Respond pedagogically to the student with interleaved text and audio."
        )
        chat.add_text(system_instruction)
        chat.end_turn()

        # Add recent conversation history turns
        for h in parsed_history[-4:]:
            role = "assistant" if h.get("role") in ["ai", "assistant"] else "user"
            content = h.get("content", "").replace("<[^>]*>", "").strip()
            if content:
                chat.new_turn(role)
                chat.add_text(content)
                chat.end_turn()

        # Add user audio turn (+ optional text message)
        chat.new_turn("user")
        nonlocal wav_tensor
        if wav_tensor.ndim == 1:
            wav_tensor = wav_tensor.unsqueeze(0)
        chat.add_audio(wav_tensor, sr)
        if message and message.strip():
            chat.add_text(message.strip())
        chat.end_turn()

        # Generate assistant interleaved response
        chat.new_turn("assistant")
        text_tokens = []
        audio_tokens = []

        max_tokens = 128 if model_state["device"] == "cpu" else 256
        logger.info(f"Running LFM2.5-Audio-1.5B generate_interleaved (max_new_tokens={max_tokens})...")
        with torch.no_grad():
            for token in model.generate_interleaved(**chat, max_new_tokens=max_tokens):
                if token.numel() == 1:
                    text_tokens.append(token)
                else:
                    audio_tokens.append(token)

        # Decode generated text tokens
        generated_text = ""
        if text_tokens:
            text_tensor = torch.cat(text_tokens) if len(text_tokens) > 1 else text_tokens[0]
            try:
                generated_text = processor.text.decode(text_tensor)
            except Exception:
                generated_text = processor.decode(text_tensor)

        if not generated_text:
            generated_text = "Audio response generated."

        # Decode generated audio codes into waveform
        out_audio_bytes = b""
        if audio_tokens:
            audio_codes = torch.stack(audio_tokens[:-1] if len(audio_tokens) > 1 else audio_tokens, 1).unsqueeze(0)
            waveform = processor.decode(audio_codes)
            wav_buf = io.BytesIO()
            sf.write(wav_buf, waveform.cpu().numpy()[0], model_state["sampling_rate"], format="WAV")
            out_audio_bytes = wav_buf.getvalue()

        audio_b64 = base64.b64encode(out_audio_bytes).decode("utf-8") if out_audio_bytes else ""
        out_duration = round(len(out_audio_bytes) / (model_state["sampling_rate"] * 2), 2) if out_audio_bytes else 0

        logger.info(f"✅ Real LFM inference completed: text_len={len(generated_text)}, audio_duration={out_duration}s")

        return {
            "success": True,
            "model": model_state["model_name"],
            "input_type": "audio",
            "text": generated_text.strip(),
            "audio_base64": audio_b64,
            "audio_format": "wav",
            "sampling_rate": model_state["sampling_rate"],
            "duration_seconds": out_duration,
            "device": model_state["device"],
            "is_mock_fallback": False,
        }

    try:
        return await asyncio.to_thread(_execute_lfm_inference)
    except Exception as inf_err:
        logger.error(f"Inference error in real LFM model: {inf_err}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference failed in LFM Audio model: {str(inf_err)}",
        )


if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    port = int(os.environ.get("LFM_AUDIO_PORT", 8001))
    host = os.environ.get("LFM_AUDIO_HOST", "127.0.0.1")
    logger.info(f"🚀 Starting Real LFM Audio microservice on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
