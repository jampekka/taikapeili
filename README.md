# The Other Side — Halloween mirror

Dummy mode is the default on every page load. It makes no image API calls. The UI is a live mirrored camera, vanity lights and two Finnish text/whisper cues. Debug controls are at `?debug=1`.

## One run

`assets/run.js` is the only lifecycle owner: idle → running → reveal → idle, or visible error. The first Tiny Face Detector result while idle captures a snapshot and starts image preparation and narration concurrently. Subsequent detections cannot start another run. While a run is active, optional debug detection only updates the overlay; it cannot start or cancel a run. A final live eye landmark pass aligns the reveal. Losing a face, its position/size, and viewport resize cannot cancel a run. Explicit page shutdown cancels it.

The cues are “Tule lähemmäksi” immediately and “Katso syvälle silmiisi” at 3 seconds. The sequence completes at 7 seconds. A single reveal starts only when both the image is ready and the sequence has completed. There are no visitor IDs, cached stock scares, implicit retries, hidden backoffs or separate server busy locks. A preparation error is displayed with an explicit retry button.

## Dummy and reveal

The dummy applies local horror makeup to the captured image. A single landmark pass measures the eyes on that snapshot. A snapshot-only BodyPix mask removes the background where available; segmentation never controls triggering. The completed dummy is rotated around the eye midpoint so the eyes are level. Estimated eye positions are used if landmarks fail.

The reveal uses a separate full-resolution 2D canvas. It has no RGB displacement, morphing or oscillation. Vanity lights go off; the image zooms from 0.02 scale to 1.3 in 60 ms, then pushes to 1.6 around the captured eye midpoint, positioned at the latest live eye midpoint. A final live landmark pass runs before the lights go off. The reveal ends at 650 ms. Reduced motion uses a static scale.

The live mirror retains its existing radial RGB warp. The debug overlay stays visible during the sequence and follows the live green-channel warp; toggling it does not change morph strength.

## Sound

One bundled 720 ms scream burst replaces all three former scare effects. It is edited from “Female Scream Horror” by NeoPhyTe, listed as Public Domain on SoundBible. The leading silence was removed, loudness normalized and the tail faded. Source and edits are documented in `assets/audio/SOURCES.txt`. Finnish whispers remain bundled recordings. All audio clips are fetched and decoded during startup. Audio needs one page gesture under browser autoplay rules; unlocking retries the current cue if it is still active. Interruption exposes the sound button again; failed clips can be retried. Locked audio never delays the sequence.

## Remote image backup path

Debug can opt into direct OpenAI `gpt-image-2.5-flare` or a retained OpenRouter model. Each remote run makes one request. A remote failure prepares the dummy from the same snapshot and uses the same reveal barrier; no second reveal is scheduled. Remote mode is not persisted across reloads.

`OPENAI_API_KEY` and optional `OPENROUTER_API_KEY` are Sites server secrets. They never enter browser code, config responses, logs or Git. The browser calls `/api/mirror/edit`; the Worker validates and forwards the single request without a per-user in-memory queue. Page cancellation is forwarded when exposed by the host. It does not guarantee cancellation of upstream billing.

Direct Flare uses low quality, JPEG and 768×1024 portrait output. The first fictional-portrait test took 14.52 seconds on 2026-10-30; this was not a speed improvement over earlier Klein tests. Debug separates image preparation and provider timing. OpenAI's response does not supply a monetary cost, so no cost is invented.

## Validation

Build: `node scripts/build.mjs`. Artifact: `node scripts/validate-artifact.mjs`.

Tests: `node tests/audio.test.mjs`, `node tests/overlay.test.mjs`, `node tests/run.test.mjs`, `node tests/portrait.test.mjs`, `node tests/renderer.test.mjs`, `node tests/provider.test.mjs`, `node tests/openai.test.mjs`, `node tests/worker.test.mjs` and `node tests/presence.test.mjs`.

The run tests cover both completion orders, duplicate detection suppression, exactly one reveal, explicit shutdown, and error recovery. Portrait tests check the eye-level rotation and reveal zoom. The real face detector can be tested with `?test=portrait&debug=1&mute=1&backend=cpu`; `?test=empty` must not trigger. Add `&move=1` to shift the fixture down during the sequence and verify the latest-eye anchor. Add `&delay=12000` in debug to exercise image preparation outlasting the sequence without making paid calls.

Physical iPad camera/speaker behavior and GPU rendering still require device testing. All photos and masks stay in browser memory in dummy mode. Remote mode uploads snapshots to the selected image provider. The fictional `portrait.jpg` fixture was generated with imagegen. Vendor notices are in `assets/vendor/`.
