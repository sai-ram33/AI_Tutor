"""
Standalone verification script for Qwen2.5-VL-3B-Instruct model pipeline
"""
import sys
import io
# pyrefly: ignore [missing-import]
import torch

# pyrefly: ignore [missing-import]
from PIL import Image, ImageDraw, ImageFont

def test_qwen_pipeline():
    print("====================================================")
    print("🔍 Testing Qwen2.5-VL-3B-Instruct Model Loading & Inference")
    print("====================================================\n")

    print("Hardware Inspection:")
    print(f"- PyTorch Version: {torch.__version__}")
    print(f"- CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"- GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"- GPU Memory: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
    else:
        print("- Execution Mode: CPU (Intel Iris Xe / Host CPU)")

    print("\n1. Generating Synthetic Educational Test Image...")
    img = Image.new("RGB", (400, 200), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.rectangle([10, 10, 390, 190], outline=(0, 0, 0), width=3)
    draw.text((30, 40), "Math Question for AI Tutor:", fill=(0, 0, 0))
    draw.text((30, 90), "What is 15 * 4 + 10?", fill=(0, 50, 200))
    draw.text((30, 140), "Explain step by step.", fill=(100, 100, 100))

    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    print("   ✅ Synthetic test image created successfully (PNG format).")

    print("\n2. Testing Transformers & Qwen2.5-VL Processor Loading...")
    try:
        # pyrefly: ignore [missing-import]
        from transformers import AutoProcessor
        model_name = "Qwen/Qwen2.5-VL-3B-Instruct"
        print(f"   Downloading/Loading AutoProcessor for {model_name}...")
        processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=True)
        print("   ✅ AutoProcessor loaded successfully.")
    except Exception as e:
        print(f"   ❌ Processor loading error: {e}")
        return False

    print("\n3. Testing Qwen2.5-VL Model Initialization...")
    try:
        # pyrefly: ignore [missing-import]
        from transformers import Qwen2_5_VLForConditionalGeneration
        device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.bfloat16 if torch.cuda.is_available() else torch.float32

        print(f"   Loading {model_name} on {device} ({dtype})...")
        model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            model_name,
            torch_dtype=dtype,
            device_map="auto" if device == "cuda" else {"": "cpu"},
            trust_remote_code=True,
            low_cpu_mem_usage=True,
        )
        model.eval()
        print("   ✅ Qwen2.5-VL-3B-Instruct loaded into memory.")

        # Test prompt
        # pyrefly: ignore [missing-import]
        from qwen_vl_utils import process_vision_info
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": img},
                    {"type": "text", "text": "Solve and explain the math problem in this image."},
                ],
            }
        ]

        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )
        inputs = inputs.to(model.device)

        print("\n4. Running Visual Inference...")
        with torch.no_grad():
            generated_ids = model.generate(**inputs, max_new_tokens=256)

        generated_ids_trimmed = [
            out_ids[len(in_ids):] for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
        ]
        output_text = processor.batch_decode(
            generated_ids_trimmed, skip_special_tokens=True, clean_up_tokenization_spaces=False
        )[0]

        print("\n====================================================")
        print("🎉 Qwen Model Generated Output:")
        print("====================================================")
        print(output_text.strip())
        print("====================================================\n")
        return True
    except Exception as e:
        print(f"   ❌ Inference error: {e}")
        return False

if __name__ == "__main__":
    test_qwen_pipeline()
