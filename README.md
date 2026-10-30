# The Other Side — Halloween mirror

A buildless, edge-to-edge camera mirror. A small Worker serves the assets and the protected image-edit endpoint over HTTPS. Source assets are in `assets/`; `node scripts/build.mjs` embeds them into `dist/server/index.js`. Fourteen large white bulb overlays provide screen illumination (twelve on narrow phones); there is no solid frame or normal-use interface. The camera permission/retry UI disappears when ready. A small “Tap once for sound” prompt disappears after a page gesture unlocks browser audio. Visual reveals work without touching the page.

## Automatic jump scare

- Tiny Face Detector and the tiny 68-point landmark model run locally on sampled camera frames. The first qualifying detection captures immediately: no stable-face wait, countdown or artificial dummy-render delay.
- `transformSnapshot` (`assets/effects.js`) produces the local dummy zombie effect, aligned to detected eye position, size and rotation. It can be replaced by the real OpenRouter image provider below. The live camera continues while editing.
- When the result is ready, it snaps in with a short zoom/jolt and a randomized synthesized shriek, orchestral stab or monster growl. The original live mirror returns after approximately 1.4 seconds, then another capture is allowed after six seconds.
- A sustained face loss or clearly different visitor position invalidates pending work. Normal movement during a slow model request is allowed. Hidden pages stop the camera and cancel work; visible pages resume. Screen wake lock is requested where supported.
- WebGL accelerates detection when available; CPU is the fallback. `?backend=cpu` forces CPU for diagnostics. Face models and scripts are served locally; there are no runtime CDN dependencies.
- Reduced-motion preferences suppress the zoom/jolt. Sound is synthesized with Web Audio, with a master volume and dynamics compressor. No microphone, audio recording, external sound files or service is needed.

## Debug view

`?debug=1` enables a translucent panel and optional face boxes/eye dots. It shows source resolution, detector/backend status, face confidence, scan timing, provider/request progress, render latency, reveal count, audio status, API request count, reported API cost and redacted recent errors/events. Debug-only controls test sounds, trigger a reveal, select a sound, adjust volume and configure the image provider. Normal mode has none of these controls.

Other development query parameters:

- `?test=portrait` feeds the included sample portrait through the real crop/detection/landmark/reveal pipeline without a physical camera. `?test=empty` supplies a blank scene. No visitor action is needed to run either fixture.
- `?mute=1` suppresses audio for testing.
- `?effect=ghost` or `?effect=aged` selects alternative effects without adding visible normal-use controls.
- Combine parameters with `&`, e.g. `?test=portrait&debug=1&mute=1&backend=cpu`.

## OpenRouter image editing

The published Site uses a server-side `OPENROUTER_API_KEY` secret and defaults to the configured image provider automatically. `IMAGE_MODEL` sets the initial model; the default is `google/gemini-3.1-flash-lite-image` (Nano Banana 2 Lite), verified against OpenRouter's live catalog. The browser first reads `/api/mirror/config`, then posts captured JPEGs to `/api/mirror/edit`. The Worker calls `POST https://openrouter.ai/api/v1/images` with an editing prompt and `input_references`, then returns edited image bytes without exposing the key.

In `?debug=1`, the key status is only “configured on server”. **Use image model** selects one of the supported Gemini image models; **Use dummy** switches to the local effect for this tab. Sound, volume, model and provider choices are stored in the tab's `sessionStorage`; no API key is stored there or in the browser bundle. A fresh tab defaults to the real server provider when configured. Local preview has no production secrets and defaults to dummy mode.

With the server model enabled, automatic face snapshots go to OpenRouter and its selected model provider, and requests are billed. The live camera remains visible until the edited result arrives; image and sound then appear together. The server handles only one in-flight request per visitor per isolate, validates image size/type and the allowed model, rejects cross-origin browser writes, and relies on the confirmed owner-private Sites dispatch for access control. Sites service access is supported for diagnostics. Secrets are never returned in config, image responses or errors.

Face loss, page hiding, source changes or provider changes abort the local request and discard stale responses. Aborting HTTP does not guarantee cancellation or non-billing upstream. Requests time out after 80 seconds on the server (90 in the browser). Most failures back off ten seconds; configuration/auth/balance errors pause until settings are reapplied. Errors are visible in debug; no silent dummy fallback disguises a failed model request.

References: https://openrouter.ai/blog/tutorials/nano-banana/ and https://openrouter.ai/api/v1/images/models .

## Validation

- `node --check assets/app.js` (also `assets/audio.js`, `cycle.js`, `effects.js`, `provider.js`).
- `node tests/cycle.test.mjs`: empty scenes, immediate first capture, one in-flight capture, reveal timing, repeat, departure, normal movement, major position changes, reset, error backoff.
- `node tests/provider.test.mjs`: reference-image request structure, model options/aspect ratio, image decoding, costs, authentication header, key redaction, HTTP and network failures. Uses mocked HTTP; no paid requests.
- Browser QA: scan 1 triggers reveal 1; repeated automatic reveals; debug controls/overlay; audio unlock and all three sound variants; server-provider status and unavailable-provider handling. End-to-end paid-model checks use only the AI-generated test portrait.
- `node scripts/validate-artifact.mjs` and `node tests/worker.test.mjs`: Worker artifact, embedded assets, secret-free configuration, server authentication, successful image responses, origin/type/model checks and redacted upstream errors.
- Physical iPad camera/speaker behavior, sustained device performance and illumination still require a device check. Browser audio requires a page gesture. Model latency remains in addition to capture/detection time.

## Assets and privacy

Local dummy mode sends no camera frames or landmarks anywhere and retains them only in memory. Remote mode sends captured JPEGs to OpenRouter as described above. Face detection is geometric tracking, not identity recognition. `assets/portrait.jpg` is the previously generated sample photo used only by the explicit test fixture, never normal camera mode. Third-party face-api.js/model licenses are in `assets/vendor/LICENSE` and `NOTICE.txt`. Horror audio is synthesized by this project.

## Lower-latency profiles

Remote snapshots are resized to at most 512px on the long edge before JPEG encoding. Debug exposes output-size selection for models that support it. Nano Banana Lite remains restricted to 1K output; Nano Banana 2 supports 512px and 1K in this app, defaulting to 512px. FLUX.2 Klein 4B is available as a lighter image editor; it uses its native output size and JPEG output, without sending an unsupported resolution parameter. Live same-portrait latency comparisons guide the production default via IMAGE_MODEL. Actual latency varies with provider load.
