"""
Comprehensive verification test suite for LiquidAI/LFM2.5-Audio-1.5B Audio Service
Tests health, model metadata, audio chat inference, validation handling, and hardware setup.
"""
import sys
import io
import math
import struct
import base64
import requests
import os
import sys

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

LFM_SERVICE_URL = os.environ.get("LFM_AUDIO_SERVICE_URL", "http://127.0.0.1:8001")


def generate_synthetic_wav(duration_sec: float = 1.0, sample_rate: int = 24000, freq: float = 440.0) -> bytes:
    """
    Generates a pure sine-wave 16-bit PCM WAV audio file directly using built-in Python struct
    (requires no external binary dependencies).
    """
    num_samples = int(sample_rate * duration_sec)
    audio_data = bytearray()

    for i in range(num_samples):
        sample_val = math.sin(2.0 * math.pi * freq * (i / sample_rate))
        int_sample = int(sample_val * 32767.0 * 0.5)
        audio_data.extend(struct.pack('<h', int_sample))

    header = bytearray()
    byte_rate = sample_rate * 2
    block_align = 2
    data_size = len(audio_data)
    chunk_size = 36 + data_size

    header.extend(b'RIFF')
    header.extend(struct.pack('<I', chunk_size))
    header.extend(b'WAVEfmt ')
    header.extend(struct.pack('<I', 16))
    header.extend(struct.pack('<H', 1))
    header.extend(struct.pack('<H', 1))
    header.extend(struct.pack('<I', sample_rate))
    header.extend(struct.pack('<I', byte_rate))
    header.extend(struct.pack('<H', block_align))
    header.extend(struct.pack('<H', 16))
    header.extend(b'data')
    header.extend(struct.pack('<I', data_size))

    return bytes(header + audio_data)


def test_hardware_environment():
    print("====================================================")
    print("🖥️  1. Hardware & Environment Diagnostic")
    print("====================================================")
    try:
         # pyrefly: ignore [missing-import]
        import torch
        print(f"   - PyTorch Version: {torch.__version__}")
        print(f"   - CUDA Available:  {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"   - GPU Device:      {torch.cuda.get_device_name(0)}")
            print(f"   - Device Memory:   {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
        else:
            print("   - Active Hardware: CPU (Optimized for 16GB RAM / Intel Iris Xe)")
    except ImportError:
        print("   - PyTorch: Not installed in active Python environment (using standard API test suite)")
    print()


def test_service_endpoints(base_url: str = LFM_SERVICE_URL):
    print("====================================================")
    print(f"🌐 2. Testing LFM Audio Microservice at {base_url}")
    print("====================================================")

    # 1. Health Check Test
    print("\n[A] Testing GET /health...")
    try:
        res = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status Code: {res.status_code}")
        data = res.json()
        print(f"   Response: {data}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert data.get("service") == "lfm-audio", "Unexpected service name"
        assert data.get("is_mock_fallback") is False, f"Mock fallback detected on /health: {data}"
        assert data.get("ready") is True, f"Service is not marked ready: {data}"
        print("   ✅ GET /health passed (Real Model Loaded, is_mock_fallback: False, ready: True).")
    except Exception as e:
        print(f"   ❌ GET /health failed: {e}")
        print("   👉 Make sure the Python service is running via: npm run start:audio")
        return False

    # 2. Model Info Test
    print("\n[B] Testing GET /model-info...")
    try:
        res = requests.get(f"{base_url}/model-info", timeout=5)
        print(f"   Status Code: {res.status_code}")
        data = res.json()
        print(f"   Model: {data.get('model')}")
        print(f"   Architecture: {data.get('architecture')}")
        print(f"   Supported Formats: {data.get('supported_input_formats')}")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert "wav" in data.get("supported_input_formats", []), "WAV format not listed"
        assert data.get("is_mock_fallback") is False, "Mock fallback detected on /model-info"
        assert data.get("ready") is True, "Service not marked ready on /model-info"
        print("   ✅ GET /model-info passed.")
    except Exception as e:
        print(f"   ❌ GET /model-info failed: {e}")
        return False

    # 3. Audio Chat Inference Test (Valid audio upload)
    print("\n[C] Testing POST /audio/chat with generated WAV file...")
    try:
        wav_bytes = generate_synthetic_wav(duration_sec=1.5, sample_rate=24000, freq=440.0)
        files = {
            "audio": ("student_question.wav", wav_bytes, "audio/wav"),
        }
        form_data = {
            "message": "Explain how gravity works in simple terms.",
            "mode": "explain",
            "user_level": "beginner",
        }
        res = requests.post(f"{base_url}/audio/chat", files=files, data=form_data, timeout=180)
        print(f"   Status Code: {res.status_code}")
        chat_data = res.json()
        print(f"   Success: {chat_data.get('success')}")
        print(f"   Model: {chat_data.get('model')}")
        print(f"   Text Response: {chat_data.get('text')}")
        print(f"   Audio Format: {chat_data.get('audio_format')}")
        print(f"   Audio Base64 Length: {len(chat_data.get('audio_base64', ''))} chars")
        print(f"   Duration: {chat_data.get('duration_seconds')}s")
        print(f"   Device: {chat_data.get('device')}")

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        assert chat_data.get("success") is True, "Success was not True"
        assert len(chat_data.get("audio_base64", "")) > 100, "Audio payload is missing or too short"
        assert len(chat_data.get("text", "")) > 0, "Text transcript response is empty"
        print("   ✅ POST /audio/chat inference passed successfully.")
    except Exception as e:
        print(f"   ❌ POST /audio/chat inference test failed: {e}")
        return False

    # 4. Negative Validation Test: Missing Audio File
    print("\n[D] Testing POST /audio/chat without audio (should return 422/400)...")
    try:
        res = requests.post(f"{base_url}/audio/chat", data={"message": "Hello"}, timeout=5)
        print(f"   Status Code: {res.status_code}")
        assert res.status_code in (400, 422), f"Expected 400/422, got {res.status_code}"
        print("   ✅ Missing audio rejection test passed.")
    except Exception as e:
        print(f"   ❌ Negative test failed: {e}")
        return False

    # 5. Negative Validation Test: Invalid non-audio file format
    print("\n[E] Testing POST /audio/chat with invalid text file (should return 400)...")
    try:
        files = {
            "audio": ("not_audio.txt", b"This is plain text and not audio", "text/plain"),
        }
        res = requests.post(f"{base_url}/audio/chat", files=files, data={"message": "Test"}, timeout=5)
        print(f"   Status Code: {res.status_code}")
        assert res.status_code == 400, f"Expected 400, got {res.status_code}"
        print("   ✅ Invalid file rejection test passed.")
    except Exception as e:
        print(f"   ❌ Invalid format test failed: {e}")
        return False

    print("\n====================================================")
    print("🎉 ALL LFM AUDIO SERVICE TESTS PASSED SUCCESSFULLY!")
    print("====================================================\n")
    return True


if __name__ == "__main__":
    test_hardware_environment()
    url = sys.argv[1] if len(sys.argv) > 1 else LFM_SERVICE_URL
    test_service_endpoints(url)
