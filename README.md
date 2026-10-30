# The Other Side — automatic Halloween mirror

The normal interface is only the live camera and vanity bulbs. Camera access is requested at startup; a page gesture unlocks horror audio once. Source assets are in `assets/`. A dependency-free build embeds them and the Worker into `dist/server/index.js`; `node scripts/build.mjs` builds it, and `node scripts/validate-artifact.mjs` validates the artifact. Hosting and access remain owner-private through Sites.

## Detection and immediate scares

A small BodyPix MobileNetV1 0.50 model with 1-byte weights (~0.6MB) detects people and supplies foreground masks. It reuses the existing TensorFlow backend, preferring WebGL and falling back to CPU. Detection operates on a cached camera frame with a maximum edge of 160px, not on the warped display. Nearly unchanged frames reuse the mask for up to 1.5 seconds; observed motion forces another inference. Tiny masks below 3.5% coverage do not count as a person. Presence inference pauses during the mirror's own blackout and a short exposure-recovery interval, preventing false departure events when the bulbs turn off. Face detection is only needed for dummy-effect alignment or as a fallback if person segmentation cannot initialize.

On the first person detection, the app captures a fresh frame and requests the visitor’s personalized edit. Text and bundled Finnish female whispers say “Tule lähemmäksi” and then “Katso syvälle silmiisi”. Both cues finish before any reveal. If the edit is still pending, the preloaded fictional horror cutout supplies a paced first scare. The camera continues to warp while the model works. The personalized result appears as soon as ready and becomes the in-memory cache for later scares. Repeat scares during the same visit use that cached personalized image rather than making repeated API calls. A new visit begins after sustained person absence. There is no identity recognition: a continuous handover without an empty scene may retain the prior cache until presence resets.

The initial cached stock scare and any previous cached image are not a newly generated likeness of the current visitor. This deliberately separates an immediate jump scare from the slower personalized edit. The optional debug view distinguishes cached and fresh scares.

## Background removal and animation

The foreground mask from the captured frame is applied to the edited image, with softened alpha edges. The image prompt additionally requests an isolated person against pure black. During reveals, the camera background is replaced by black and all vanity bulbs switch off.

The cutout zooms from approximately 0.001 scale to full size in 145ms, then oscillates in scale while independent RGB deformations ripple across it. A normal reveal lasts about 1.6 seconds; repeats wait six seconds. A shader continuously warps the entire live view with independent red, green and blue displacement, stronger while a fresh edit is pending. Smooth radial weighting fades displacement toward the borders; live sampling clamps at the image edges. Intentional reveal black remains. WebGL is preferred; a lower-resolution Canvas RGB-warp fallback runs without GPU support. Reduced-motion preferences suppress the rapid zoom and reduce deformation.

Horror sounds use three bundled audio samples: shriek, orchestral stab and monster growl. Finnish whisper clips were generated once using ElevenLabs eleven-v4, Sarah, through OpenRouter. Playback uses Web Audio. They are randomized without immediately repeating the same variant. A master volume and compressor limit peaks. Audio requires one user gesture under browser autoplay rules; visual scares work before it is unlocked. No microphone permission or runtime speech service is used. All audio files are bundled and preloaded.

## Image providers

The server holds `OPENAI_API_KEY` and optional `OPENROUTER_API_KEY`; neither reaches browser code, URLs, config responses or logs. `IMAGE_MODEL` selects the production default, currently `gpt-image-2.5-flare` through direct OpenAI. The browser reads `/api/mirror/config` and sends a captured JPEG to `/api/mirror/edit`. Uploads are resized to at most 512px. For legacy OpenRouter models the Worker calls `POST https://openrouter.ai/api/v1/images` with `input_references`; Flare uses direct OpenAI as described below. The endpoint validates model/type/size, rejects cross-origin browser requests, and relies on the existing owner-private Sites access boundary. One request per visitor per isolate is allowed at a time. Production secrets are absent from local preview, which uses dummy effects.

Model profiles available in debug:

- FLUX.2 Klein 4B: native output size, JPEG output. No unsupported resolution option is sent.
- Nano Banana 2 Lite: 1K output only.
- Nano Banana 2: 512px output by default, or 1K.
- Original Nano Banana: native output size.

Model tests on the same fictional imagegen portrait, with 512px uploads, on 2026-10-30:

| Profile | Observed end-to-end times | Reported cost/image |
| --- | --- | --- |
| Nano Banana 2 Lite, 1K | 14.54s | $0.03391 |
| Nano Banana 2, 512px | 10.90s, 12.12s | ~$0.0455 |
| FLUX.2 Klein 4B, native | 11.56s, 10.97s | $0.015 |

These few tests did not establish a meaningful personalized-image speedup. Klein was initially selected for the lower cost and useful horror result; Flare is now the requested default. Cached scares provide the immediate response; hosted editing still takes seconds and varies with provider load. This is not a guaranteed latency benchmark.

Changing provider, leaving the page or sustained person loss cancels local work and suppresses stale replies. Cancellation does not guarantee that an upstream job stops or avoids billing. Timeouts are 80 seconds on the server and 90 in the browser. Most failures back off ten seconds; configuration/auth/balance errors pause until settings are reapplied. No silent dummy fallback disguises a failed remote edit.

## Debug controls

Open `?debug=1` for presence/mask status, inference timing, cached-frame skips, renderer backend, cache/fresh events, model/request timing, errors, sound state, reported API cost and face/person geometry overlays. Debug controls test sounds, reveal immediately, adjust morph strength and volume, disable instant cached scares, switch providers, and choose supported output resolution. Preferences are stored in the tab session; photos are kept only in memory.

Development parameters:

- `?test=portrait`: the fictional sample portrait through the real detection/mask/render pipeline.
- `?test=empty`: a blank scene; it must not trigger scares.
- `?mute=1`: suppress audio.
- `?backend=cpu`: force the CPU ML backend.
- `?effect=ghost` or `?effect=aged`: alternative transformation prompts/effects.
- `?debug=1&hold=6`: extend the debug reveal for inspecting foreground masks and lamp blackout; normal reveals are unchanged.

Combine with `&`, e.g. `?test=portrait&debug=1&mute=1&backend=cpu`.

## Verification

Run `node tests/cycle.test.mjs`, `node tests/provider.test.mjs`, `node tests/worker.test.mjs` `node tests/presence.test.mjs` and `node tests/lead-in.test.mjs`. These cover trigger timing, single in-flight edits, departures, stale work, retries, supported request parameters, secret redaction, Worker assets/HTTP validation, empty masks and person bounds.

Browser QA verified real person segmentation on the synthetic portrait, empty-scene behavior, mask caching, instant cached scares, full-frame Canvas RGB warping, foreground isolation and zero opacity on all four bulb groups during a reveal. CPU inference was approximately 90–175ms in this test; cached checks were about 1ms. All three sound variants and audio unlocking were checked previously. Live paid-model tests use only the verified fictional AI-generated fixture, not a private photo. Physical iPad camera/speaker behavior, GPU rendering and sustained device performance still need a device check.

## Assets and data

`portrait.jpg` was generated by image_gen in this conversation. `scare-cache.jpg` was generated by editing that fictional portrait through OpenRouter. They are stock test/scare assets, not visitor photos. Foreground masks, camera frames and personalized caches remain in browser memory; remote mode sends captured JPEGs to OpenRouter and its selected provider. Third-party licenses and notices are in `assets/vendor/`.

References: https://openrouter.ai/api/v1/images/models , https://openrouter.ai/blog/tutorials/nano-banana/ , https://github.com/tensorflow/tfjs-models/tree/master/body-pix .

## Face-trigger regression fix

An empty body mask no longer blocks triggering. When segmentation misses a close-up face, a separate Tiny Face Detector probe runs at up to 224px input without the landmark network. Recent face results are reused between probes. Body-model runtime failures disable only segmentation and preserve camera/face triggering. Debug now separates face checks/confidence, body-mask coverage and the actual trigger source; `?debug=1&detect=face` forces the face path for diagnosis.

## Theatrical sequence

Presence starts the sequence. “Tule lähemmäksi” and “Katso syvälle silmiisi” are timed theatrical cues: face position and apparent size do not advance, restart or cancel them. Sustained absence still ends the visit. The reveal has no live eye-alignment step.

## Direct OpenAI Flare

The default is now `gpt-image-2.5-flare` through OpenAI's `/v1/images/edits`, with low quality, JPEG and 768×1024 portrait output (landscape and square sizes adapt). The API key is the server secret `OPENAI_API_KEY`; it is never sent to the browser. OpenRouter models remain available explicitly in debug. The new settings namespace resets older saved model selections once so they cannot silently override this switch.

The first direct test on the fictional portrait took 14.52 seconds on 2026-10-30, produced 768×1024 JPEG and reported 835 input tokens and 134 output tokens. This single test was not faster than the earlier Klein test. Direct OpenAI does not report a monetary cost on this response; the UI leaves cost unknown. Debug now displays provider turnaround separately from reveal/narration timing. Incoming request cancellation is forwarded to the provider fetch when the host exposes it; cancellation does not guarantee stopped upstream billing.

The sequence simplification, face-only triggering and short scream selection remain follow-up work. This change switches the image provider; it does not claim those pending changes are finished.
