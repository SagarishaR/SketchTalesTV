import sys
import os
import json
import shutil
from pathlib import Path
from gradio_client import Client, handle_file

SPACE_ID = "preSalesAIAutomation/imagetovideo"

def generate_video(image_path, prompt, output_path):
    client = Client(SPACE_ID, token=os.environ.get('HF_TOKEN') or None)

    generated_video, seed = client.predict(
        input_image=handle_file(image_path),
        prompt=prompt,
        steps=6,
        negative_prompt=(
            "blurry, distorted character, extra limbs, warped shape, "
            "text, subtitles, logos, frightening imagery"
        ),
        duration_seconds=3.5,
        guidance_scale=1,
        guidance_scale_2=1,
        seed=42,
        randomize_seed=True,
        api_name="/generate_video_sync",
    )

    # Gradio returns a video object containing its local filepath.
    if isinstance(generated_video, dict):
        video_path = generated_video.get("video")
    else:
        video_path = generated_video

    if not video_path or not Path(video_path).is_file():
        raise RuntimeError(
            f"Wan returned no accessible video file: {generated_video!r}"
        )

    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(video_path, destination)

    return {"videoPath": str(destination), "seed": seed}


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(
            "Usage: python wan_client.py IMAGE_PATH PROMPT OUTPUT_PATH",
            file=sys.stderr,
        )
        sys.exit(2)

    try:
        result = generate_video(sys.argv[1], sys.argv[2], sys.argv[3])
        print(json.dumps({"ok": True, **result}))
    except Exception as exc:
        print(
            json.dumps({"ok": False, "error": str(exc)}),
            file=sys.stderr,
        )
        sys.exit(1)