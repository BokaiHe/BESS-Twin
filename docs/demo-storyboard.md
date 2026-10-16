# Demo recording

The recording shows the real English UI in an isolated browser context. It uses default sunny-day parameters and does not change storage in an already-open user session. All displayed power, SOC and comparison results come from the simulation; the script never substitutes financial numbers.

| Approximate time | Action                                                             | Purpose                                                                                 |
| ---------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 0–5 s            | Start sunny-day playback at 07:00                                  | Show shared precomputed snapshots driving the scene and cards.                          |
| 5–8 s            | Pause, seek to 19:00 and select BESS-01                            | Connect evening-peak dispatch with a specific storage unit.                             |
| 8–20 s           | Open the container, then cell layers and the cutaway               | Show the intact enclosure and snapshot-linked discharge animation.                      |
| 20–30 s          | Open What if…, change capacity from 20 to 40 MWh, wait for results | Compare stored energy and cost using actual recalculated results, with power unchanged. |

These are presentation timings, not simulation intervals. The final file contains the last 30 seconds of the captured browser video, removing startup frames. Small offsets depend on rendering and calculation speed; chapter timestamps are logged before trimming. The script fails rather than recording stale comparison results, page errors or an excessively delayed run.

## Reproduce locally

1. Use the existing project dependencies (`npm ci`), an installed Microsoft Edge, the Playwright recorder (`npx playwright install ffmpeg`), and a full FFmpeg on PATH. FFmpeg is an external authoring tool, not an application dependency. Set `FFMPEG_PATH` to its executable if needed; `PLAYWRIGHT_CHANNEL` can choose another installed Playwright browser channel.
2. Start the local app with `npm run dev` (Windows: `npm.cmd run dev`).
3. In another terminal run `node scripts/capture-demo.mjs`. For a Pages preview, pass a local URL, e.g. `node scripts/capture-demo.mjs http://127.0.0.1:5180/BESS-Twin/`.
4. Inspect `docs/demo.webm` and `docs/demo.gif` before sharing. The GIF is 800 px wide at 6 fps to control file size; the WebM is 1440 × 1080. Use the WebM for readable details and smoother motion.

The script overwrites only its named demo outputs and creates a unique temporary recording directory. Failed recordings retain raw video for diagnosis. It does not push commits, deploy, change production data or use the user's active browser. The GIF is embedded only in the README, never loaded into the application's first screen.

## Scope and completion

Learning-edition stages 0–7 already have implementation and validation records. Stage 8 adds the project explanation tab, this storyboard, the reproducible recorder and locally generated media. Final step-8 checks are recorded in `verification.md`.

A separate reviewer can still work through the unchecked audit checklist in `learning-edition-spec.md`. Publishing these local stages to GitHub and deploying them remain pending explicit release instructions. CSV import, custom event scheduling, annual economics and shareable parameter URLs are future ideas outside this eight-step learning-edition specification.
