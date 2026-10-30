# The Other Side

Buildless Halloween mirror prototype, designed for iPad Safari and desktop browsers. Serve `dist` over HTTPS for camera access. No installation or build step.

## Interaction

Open the camera (front-facing by default), try the sample portrait, or upload a photo. Select Undead, Timeworn, or Apparition. The mirror captures a still after a three-second countdown, asynchronously transforms it, fades to the result, then optionally returns to the live camera. Settings control automatic reveals, the live and reveal durations, intensity, the face guide, and gentle transitions. The original can be toggled and the transformed PNG shared/downloaded. Fullscreen falls back to a browser-based mirror mode on iPad. Escape exits it; Space triggers a reveal or returns to the mirror.

Photos and camera frames stay in browser memory. Camera tracks are stopped when switching to the demo/photo, resetting, or leaving. There is no server, external image API, saved photo storage, or embedded API key. Fonts use Google Fonts with local fallbacks.

## Runtime image provider

This version explicitly uses a dummy, canvas-based provider. Greenish color grading, under-eye shading and branching veins simulate undead; wrinkles and age spots simulate ageing; cold color grading, glowing eyes and ghosting simulate an apparition. Face placement is approximate: follow the guide or tap between the eyes to reposition the effects. No face detection or model inference is performed.

Replace `generateMirrorSnapshot` in `dist/app.js` with an asynchronous server image-edit request. Input: `{image, effect, intensity, cx, ey}`. The captured `image` is a 900×1200 canvas. Return a canvas or drawable image; return no result after cancellation. The calling reveal flow already rejects stale completions by token. A production API should send a JPEG to a server endpoint, use an environment secret for OpenRouter/provider credentials, return an edited image, enforce a request timeout, and retain the same error/retry behavior. Never embed shared API keys in frontend source. Chat-time image generation is not a callable runtime capability for this static Site.

## Sample asset

`dist/portrait.jpg` is an AI-generated sample input created with the built-in image-generation tool, then resized and converted to JPEG. Prompt: “Use case: photorealistic-natural. Asset type: sample input portrait for a Halloween mirror webapp. Generate a single natural editorial photo, vertical 3:4 composition, adult person around 35 with short wavy brown hair, androgynous appearance, a black high-neck sweater, facing straight towards the camera, head level, neutral expression and open eyes, centered perfectly. Face occupies center, top of head at 18% of image, eyes on 40% horizontal line, chin at 69%. Shoulders at bottom. Dark muted charcoal studio backdrop, soft warm cinematic light from the left and faint cool fill, beautifully textured real skin. Ordinary untransformed living person, no Halloween makeup or props. No text, no border, no watermark.”

## Verification

`node --check dist/app.js`. Browser QA covers demo entry, automatic reveal, original comparison, effect selection, settings and fullscreen mode. Physical iPad camera capture, Safari sharing, and device-specific permissions require testing on the device.
