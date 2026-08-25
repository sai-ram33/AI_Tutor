import os
import io
import json
import logging
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image, ImageOps

# Configure clean logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [Qwen] %(message)s")
logger = logging.getLogger("qwen_service")

# Global state for loaded model and processor
model_state: Dict[str, Any] = {
    "model": None,
    "processor": None,
    "status": "uninitialized",
    "device": "cpu",
    "dtype": "float32",
    "error": None,
    "model_name": "Qwen/Qwen2.5-VL-3B-Instruct",
}


def get_optimal_device():
    import torch
    if torch.cuda.is_available():
        return "cuda", torch.bfloat16
    return "cpu", torch.float32


def load_model_and_processor():
    global model_state
    import torch
    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

    model_name = os.environ.get("QWEN_MODEL_NAME", "Qwen/Qwen2.5-VL-3B-Instruct")
    model_state["model_name"] = model_name
    model_state["status"] = "loading"

    device, dtype = get_optimal_device()
    model_state["device"] = device
    model_state["dtype"] = str(dtype)

    logger.info(f"Loading {model_name} onto device: {device} with dtype: {dtype}...")

    try:
        # Load processor
        processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)

        # Load model with automatic device mapping
        if device == "cuda":
            model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=dtype,
                device_map="auto",
                trust_remote_code=True,
            )
        else:
            model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=dtype,
                device_map={"": "cpu"},
                trust_remote_code=True,
                low_cpu_mem_usage=True,
            )

        model.eval()
        model_state["model"] = model
        model_state["processor"] = processor
        model_state["status"] = "ready"
        model_state["error"] = None
        logger.info(f"✅ {model_name} successfully loaded and ready for inference on {device}.")
    except Exception as e:
        model_state["status"] = "error"
        model_state["error"] = str(e)
        logger.error(f"❌ Failed to load {model_name}: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize model at startup
    load_model_and_processor()
    yield
    # Cleanup if needed
    model_state["model"] = None
    model_state["processor"] = None


app = FastAPI(
    title="AI Tutor - Qwen2.5-VL Vision Microservice",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """
    Health check endpoint reporting Qwen model status.
    """
    return {
        "success": True,
        "service": "qwen-vision",
        "model": model_state["model_name"],
        "status": model_state["status"],
        "device": model_state["device"],
        "error": model_state.get("error"),
    }


@app.post("/generate")
async def generate_from_image_and_prompt(
    image: Optional[UploadFile] = File(None),
    message: str = Form(...),
    history: Optional[str] = Form("[]"),
    user_level: Optional[str] = Form("beginner"),
    mode: Optional[str] = Form("explain"),
):
    """
    Inference endpoint: Accepts an image and text prompt, invokes Qwen2.5-VL-3B-Instruct,
    and returns a pedagogical educational explanation.
    """
    if model_state["status"] != "ready":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Qwen Vision model is currently not ready (status: {model_state['status']}).",
        )

    if not message or not message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message instruction is required.",
        )

    # 1. Process uploaded image if provided
    pil_image = None
    if image is not None:
        try:
            image_bytes = await image.read()
            if len(image_bytes) == 0:
                raise ValueError("Uploaded image file is empty.")
            pil_image = Image.open(io.BytesIO(image_bytes))
            pil_image = ImageOps.exif_transpose(pil_image)
            pil_image = pil_image.convert("RGB")
            # Limit very large dimensions for token/memory efficiency
            pil_image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        except Exception as img_err:
            logger.warning(f"Failed to process image: {img_err}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or unreadable image file. Supported formats: JPEG, PNG, WEBP.",
            )

    # 2. Parse previous conversation history
    parsed_history = []
    if history:
        try:
            parsed_history = json.loads(history)
        except Exception:
            parsed_history = []

    # 3. Build pedagogical system prompt
    system_prompt = (
        f"You are an expert AI Tutor. A student with a '{user_level}' learning level is asking for help.\n"
        "Explain concepts clearly and concisely. Analyze any provided educational diagrams, textbook problems, "
        "or questions step-by-step. Use encouraging, pedagogical language."
    )

    # 4. Construct messages array for Qwen2.5-VL
    messages = [
        {"role": "system", "content": [{"type": "text", "text": system_prompt}]}
    ]

    # Add relevant recent history
    for item in parsed_history[-6:]:
        role = "assistant" if item.get("role") in ["ai", "assistant"] else "user"
        content_text = item.get("content", "").replace("<[^>]*>", "").strip()
        if content_text:
            messages.append({"role": role, "content": [{"type": "text", "text": content_text}]})

    # Add current prompt + image
    user_content = []
    if pil_image is not None:
        user_content.append({"type": "image", "image": pil_image})
    user_content.append({"type": "text", "text": message.strip()})

    messages.append({"role": "user", "content": user_content})

    # 5. Run inference with Qwen2.5-VL
    try:
        import torch
        from qwen_vl_utils import process_vision_info

        model = model_state["model"]
        processor = model_state["processor"]

        logger.info(f"Processing inference request: prompt='{message.strip()[:60]}...', has_image={pil_image is not None}")

        text = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )

        inputs = inputs.to(model.device)

        with torch.no_grad():
            generated_ids = model.generate(
                **inputs,
                max_new_tokens=768,
                temperature=0.4 if mode == "explain" else 0.6,
                do_sample=True,
            )

        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0].strip()

        logger.info("Inference generation completed successfully.")

        return {
            "success": True,
            "model": model_state["model_name"],
            "response": output_text,
            "device": model_state["device"],
        }
    except Exception as inf_err:
        logger.error(f"Inference error: {inf_err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate explanation from image.",
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("QWEN_PORT", 8000))
    host = os.environ.get("QWEN_HOST", "127.0.0.1")
    logger.info(f"Starting Qwen Vision microservice on {host}:{port}")
    uvicorn.run(app, host=host, port=port)
