"""Render the approved sheet still as a seamless, silent 8-second MP4.

This is a procedural cloth loop, not generative video. Requires Pillow, NumPy,
SciPy and ffmpeg. Black is removed by screen compositing in the mirror canvas.
"""
from pathlib import Path
import subprocess
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates

ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS, SECONDS = 512, 640, 24, 8
rgba = np.asarray(Image.open(ROOT / "assets/ghost/sheet-ghost.png").convert("RGBA").resize((WIDTH, WIDTH)), dtype=np.float32)
rgb = rgba[:, :, :3] * (rgba[:, :, 3:4] / 255)
base = np.zeros((HEIGHT, WIDTH, 3), dtype=np.float32)
base[64:576] = rgb
y, x = np.mgrid[:HEIGHT, :WIDTH].astype(np.float32)
cloth = np.clip((y - 210) / 340, 0, 1)
output = ROOT / "assets/ghost/sheet-loop.mp4"
encoder = subprocess.Popen([
    "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pixel_format", "rgb24",
    "-video_size", f"{WIDTH}x{HEIGHT}", "-framerate", str(FPS), "-i", "pipe:0",
    "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", str(output),
], stdin=subprocess.PIPE)
for frame in range(FPS * SECONDS):
    phase = 2 * np.pi * frame / (FPS * SECONDS)
    scale = 1 + .004 * np.sin(phase)
    sx = (x - WIDTH / 2 - 4 * np.sin(phase)) / scale + WIDTH / 2
    sy = (y - HEIGHT / 2 - 5 * np.sin(phase + .5)) / scale + HEIGHT / 2
    sx += cloth * (3 * np.sin(phase + y * .018) + 1.6 * np.sin(2 * phase + x * .02))
    sy += cloth * 1.8 * np.sin(phase + x * .024)
    pixels = np.stack([map_coordinates(base[:, :, c], [sy, sx], order=1, mode="constant", cval=0) for c in range(3)], axis=-1)
    encoder.stdin.write(np.clip(pixels, 0, 255).astype(np.uint8).tobytes())
encoder.stdin.close()
if encoder.wait():
    raise SystemExit("ffmpeg failed")
print(f"Rendered {output.name}: {SECONDS}s, {FPS}fps, {output.stat().st_size:,} bytes")
