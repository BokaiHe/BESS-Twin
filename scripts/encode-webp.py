"""Encode the README preview (animated WebP) from the recorded demo video.

FFmpeg's libwebp_anim encoder reuses unchanged blocks between frames without periodic
keyframes; with a slowly changing 3D scene its lossy errors accumulate into visible
streaks. Pillow's libwebp animation encoder inserts keyframes, which keeps every frame
clean (measured minimum PSNR ~34 dB versus ~26 dB with FFmpeg).

Usage: python scripts/encode-webp.py <input.mp4> <output.webp> [width] [fps] [quality]
Requires FFmpeg on PATH (or FFMPEG_PATH) and Pillow.
"""
import os
import shutil
import subprocess
import sys
import tempfile

from PIL import Image


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    source, target = sys.argv[1], sys.argv[2]
    width = int(sys.argv[3]) if len(sys.argv) > 3 else 800
    fps = int(sys.argv[4]) if len(sys.argv) > 4 else 20
    quality = int(sys.argv[5]) if len(sys.argv) > 5 else 72
    ffmpeg = os.environ.get('FFMPEG_PATH', 'ffmpeg')
    work = tempfile.mkdtemp(prefix='bess-webp-')
    try:
        subprocess.run(
            [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', source,
             '-vf', f'fps={fps},scale={width}:-2:flags=lanczos', os.path.join(work, 'f%05d.png')],
            check=True,
        )
        names = sorted(n for n in os.listdir(work) if n.endswith('.png'))
        frames = [Image.open(os.path.join(work, n)).convert('RGB') for n in names]
        frames[0].save(
            target, 'WEBP', save_all=True, append_images=frames[1:],
            duration=round(1000 / fps), loop=0, quality=quality, method=6,
        )
        print(f'Saved {target}: {len(frames)} frames, {width}px, {fps} fps, '
              f'{os.path.getsize(target) / 1e6:.1f} MB')
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
