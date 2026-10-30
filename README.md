# The Other Side — automatic mirror

A buildless, camera-only Halloween mirror. Serve `dist` over HTTPS. The visible interface is only the live mirrored camera, surrounded by warm-white screen lights. No menus, title, effect picker, countdown, capture button, or result controls. Camera permission is requested at startup; a retry/enable button appears only when the browser prevents startup. Once permission is allowed, no visitor interaction is required.

## Automatic operation

1. Tiny Face Detector and the tiny 68-point landmark model run locally on sampled, cropped camera frames, using face-api.js 0.22.2 on its CPU backend. All scripts and weights are bundled with the Site. No WebGL, CDN, or native FaceDetector API is required.
2. After a face is present and reasonably steady for one second, the matching camera frame is captured. The live view continues during asynchronous processing.
3. The modified still fades in automatically for 1.7 seconds, then the live mirror returns. It repeats after about 6.5 seconds while a visitor remains.
4. Face loss or a large position/size change cancels pending work and hides a stale reveal. Eye landmarks position, scale and rotate the effect automatically.

The default transformation is a local dummy zombie effect. This is actual face detection and eye alignment, but not AI image editing. `transformSnapshot` in `dist/effects.js` is the replaceable asynchronous image-provider boundary; it receives a captured canvas, detected face geometry, effect and intensity, and returns a drawable canvas. A future provider should call a server endpoint with provider credentials kept server-side. `?effect=aged` and `?effect=ghost` are development options, with no added controls.

The browser releases camera tracks when hidden or on departure, and resumes when visible. It requests a screen wake lock where supported. No frames, landmarks, or images leave the device or persist. Bright perimeter bulbs and frame contribute screen light; physical brightness still depends on the device's brightness setting.

## Validation

- `node --check dist/app.js`, `node --check dist/effects.js`, `node --check dist/cycle.js`.
- `node tests/cycle.test.mjs` verifies that empty scenes do not trigger, steady faces automatically trigger, only one render runs at a time, reveals return to live, remaining visitors repeat, and disappearance/movement/reset invalidate stale results.
- Browser fixtures: `?test=portrait` uses the sample photograph through the same crop, detection, landmark, controller and transformation pipeline; `?test=empty` uses an empty image. These require no clicks or camera hardware. Runtime observations are exposed as `data-phase`, `data-faces`, `data-detections` and `data-reveals` on `#mirror` without visible debug UI.
- Physical iPad camera permission, sustained performance, illumination, and screen wake-lock behavior still require a device check.

## Asset provenance

`dist/portrait.jpg` is the previously generated sample portrait, used only by the explicit browser test fixture; it never appears in normal camera mode. It was generated with the built-in image-generation tool as a neutral, centered adult portrait against a dark charcoal background. Third-party license: `dist/vendor/LICENSE` and `NOTICE.txt`.
