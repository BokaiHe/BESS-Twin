# Demo recording

The recording shows the real English UI in an isolated browser context. It uses default sunny-day parameters and does not change storage in an already-open user session. All displayed power, SOC and comparison results come from the simulation; the script never substitutes financial numbers.

| Approximate time | Action                                                             | Purpose                                                                                 |
| ---------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 0–5 s            | Start sunny-day playback at 07:00                                  | Show shared precomputed snapshots driving the scene and cards.                          |
| 5–8 s            | Pause, seek to 19:00 and select BESS-01                            | Connect evening-peak dispatch with a specific storage unit.                             |
| 8–20 s           | Open the container, then cell layers and the cutaway               | Show the intact enclosure and snapshot-linked discharge animation.                      |
| 20–30 s          | Open What if…, change capacity from 20 to 40 MWh, wait for results | Compare stored energy and cost using actual recalculated results, with power unchanged. |

These are presentation timings, not simulation intervals. Capture starts once the page and 3D scene are ready, so no startup frames need trimming. Frames come from the Chrome DevTools screencast, each with its own timestamp (typically 55–85 frames per second with GPU rendering); FFmpeg rebuilds a constant 60 fps video from those timestamps, preserving real motion timing. Small offsets depend on rendering and calculation speed; chapter timestamps are logged before trimming. The script fails rather than recording stale comparison results, page errors or an excessively delayed run.

## Reproduce locally

1. Use the existing project dependencies (`npm ci`), an installed Microsoft Edge and a full FFmpeg on PATH (with libx264, libvpx-vp9 and libwebp). FFmpeg is an external authoring tool, not an application dependency. Set `FFMPEG_PATH` to its executable if needed; `PLAYWRIGHT_CHANNEL` can choose another installed Playwright browser channel.
2. Start the local app with `npm run dev` (Windows: `npm.cmd run dev`).
3. In another terminal run `npm run demo:record` (Windows: `npm.cmd run demo:record`). For a Pages preview, pass a local URL, e.g. `npm run demo:record -- http://127.0.0.1:5180/BESS-Twin/`.
4. Inspect the outputs before sharing: `docs/demo.mp4` (60 fps H.264, 1440 × 1080, widest compatibility), `docs/demo.webm` (60 fps VP9, 1440 × 1080) and `docs/demo.webp` (20 fps animated WebP, 800 px wide, embedded in the README). Animated WebP replaces GIF because GIF cannot reliably show frame delays under 20 ms and is several times larger at the same quality. The preview is encoded by `scripts/encode-webp.py` with Pillow, which inserts keyframes; FFmpeg's animated-WebP encoder accumulated lossy errors into visible streaks. This step needs Python with Pillow (`pip install pillow`).

The browser window opens by default because headed GPU rendering is fastest; keep it uncovered while recording. Set `DEMO_HEADLESS=1` to hide it. `docs/demo-recording.json` records the captured frame count and average capture rate.

The script overwrites only its named demo outputs and creates a unique temporary recording directory. Failed recordings retain raw video for diagnosis. It does not push commits, deploy, change production data or use the user's active browser. The preview image is embedded only in the README, never loaded into the application's first screen.

## Scope and completion

Learning-edition stages 0–7 already have implementation and validation records. Stage 8 adds the project explanation tab, this storyboard, the reproducible recorder and locally generated media. Final step-8 checks are recorded in `verification.md`.

A separate reviewer can still work through the unchecked audit checklist in `learning-edition-spec.md`. The recording command creates local media; publishing updated media requires committing and pushing those artifacts. CSV import, custom event scheduling, annual economics and shareable parameter URLs are future ideas outside this eight-step learning-edition specification.
