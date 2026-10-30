# The Other Side — Halloween mirror

Dummy mode is the default on every page load. It makes no image API calls. The UI is a live mirrored camera, vanity lights and three Finnish text/whisper cues. Debug controls are at `?debug=1`.

## One run

`assets/run.js` owns the lifecycle. Face presence while armed starts a two-second lead-in, then the three Finnish whisper recordings. One second without a face cancels the sequence. Three continuous seconds without a face rearm it; a continuously present face cannot repeat it. Position and size do not gate the sequence.

## Tracking and reveal

A worker processes the full, uncropped camera image at up to 10 Hz, with at most one frame in flight. MediaPipe Face Landmarker 0.10.21 uses video tracking with one face. Browsers without worker WebGL2 or WASM SIMD use the retained face-api detector and landmarks on CPU in the same worker. No extra partial-face recovery is implemented. Only presence and two eye positions are consumed. Coordinates are mapped into the mirrored display crop once. Debug shows tracker time and eye-result age.

When the whispers finish, dummy mode captures the latest camera frame and draws a colour tint, dark eye sockets and pale eyes. No segmentation, masks, pixel loops, decorative makeup, or additional inference occur in the reveal path. No portrait rotation or intermediate crop can cut away part of the captured image. The current eye midpoint anchors the translation/scale. Image preparation and frame age at reveal are reported separately.

The separate 2D reveal canvas retains the complete snapshot, with the 50 ms zoom overshoot, fading shake and brightness surges, and ends at 650 ms. Reduced motion is static. Rectangular perimeter lamps, including corner bulbs, go off during the reveal. The laugh starts 400 ms after the reveal ends. Then, if a face is present, the quiet ending instruction plays once without visible text. One second of absence stops it.

The live mirror retains the radial RGB warp. Debug boxes and eye crosshairs follow that same coordinate transform. Optional remote image generation retains its completion barrier and dummy fallback.

## Sound

One bundled 720 ms scream burst replaces all three former scare effects. It is edited from “Female Scream Horror” by NeoPhyTe, listed as Public Domain on SoundBible. The leading silence was removed, loudness normalized and the tail faded. Source and edits are documented in `assets/audio/SOURCES.txt`. Finnish whispers remain bundled recordings. The page opens at an audio-start gate. All audio clips are fetched and decoded before the mirror starts. If Web Audio cannot autoplay, the user must click “Avaa peili”. No camera, detection or sequence starts until the context is running and every clip is decoded. Audio needs one page gesture under browser autoplay rules; unlocking retries the current cue if it is still active. Interruption exposes the sound button again; failed clips can be retried. If the audio context becomes unavailable, the mirror pauses and returns to the audio-start gate.

## Remote image backup path

Debug can opt into direct OpenAI `gpt-image-2.5-flare` or a retained OpenRouter model. Each remote run makes one request. A remote failure prepares the dummy from a fresh camera snapshot and uses the same reveal barrier; no second reveal is scheduled. Remote mode is not persisted across reloads.

`OPENAI_API_KEY` and optional `OPENROUTER_API_KEY` are Sites server secrets. They never enter browser code, config responses, logs or Git. The browser calls `/api/mirror/edit`; the Worker validates and forwards the single request without a per-user in-memory queue. Page cancellation is forwarded when exposed by the host. It does not guarantee cancellation of upstream billing.

Direct Flare uses low quality, JPEG and 768×1024 portrait output. The first fictional-portrait test took 14.52 seconds on 2026-10-30; this was not a speed improvement over earlier Klein tests. Debug separates image preparation and provider timing. OpenAI's response does not supply a monetary cost, so no cost is invented.

## Validation

Build: `node scripts/build.mjs`. Artifact: `node scripts/validate-artifact.mjs`.

Tests: `node tests/audio.test.mjs`, `node tests/overlay.test.mjs`, `node tests/run.test.mjs`, `node tests/portrait.test.mjs`, `node tests/renderer.test.mjs`, `node tests/provider.test.mjs`, `node tests/openai.test.mjs`, `node tests/worker.test.mjs`, `node tests/tracker.test.mjs` and `node tests/effects.test.mjs`.

The run tests cover both completion orders, duplicate detection suppression, exactly one reveal, explicit shutdown, and error recovery. Tracker tests check the camera/display coordinate mapping and single-flight behavior. Effect tests forbid pixel readbacks and check complete-image drawing. The real face detector can be tested with `?test=portrait&debug=1&mute=1`; `?test=empty` must not trigger. Add `&presenceCycle=1` for a controlled disappearance/reappearance fixture. Add `&move=1` to shift the fixture down during the sequence and verify the latest-eye anchor. Add `&delay=12000` in debug to exercise image preparation outlasting the sequence without making paid calls.

Physical iPad camera/speaker behavior and GPU rendering still require device testing. All photos stay in browser memory in dummy mode. Remote mode uploads snapshots to the selected image provider. The fictional `portrait.jpg` fixture was generated with imagegen. Vendor notices are in `assets/vendor/`.
