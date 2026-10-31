Floating ghost heads v5

Selected artwork: option 5 (soft gauze, default), option 1 (classic sheet).
Generated with the built-in image tool from a six-head comparison. Prompts:
- Front-facing pale cloth-covered HEAD ONLY; no shoulders, torso or skirt.
- No mouth, lips, nose details, eyeballs or pupils; soft dark oval eye hollows.
- Fine pale linen, soft wispy alpha edge, completely transparent background.
- Soft option: smooth restrained gauze. Classic: more folds, smaller eye holes.

Source assets: head-soft.png, head-classic.png.
head-soft-loop.mp4 and head-classic-loop.mp4 are procedural animations of the
stills, not AI video. Rebuild: python scripts/render-ghost-loop.py (Pillow,
NumPy, SciPy, ffmpeg). Each is silent 8s / 24fps H.264/yuv420p, periodic motion.
The real PNG alpha cutout is always drawn using normal blending. Video motion
is clipped over that cutout, so black/missing video cannot hide the head.
The head fills the centre of the mirror, with bounded native hover and small
rounded glowing eyes with pointed ends and a subtle +/-2.5% zoom cycle. Eye fixations last about 3.4s with 140ms gaze shifts.
Opacity follows the live speech analyser with 700ms attack / 1500ms release.
Actual whisper playback also shows it outside automatic sequence states. Ghost defaults migrate once to
revision 3 (enabled, 90% opacity, 115% size); subsequent operator edits persist.

Separate canvas never enters face tracking or portrait capture. Appears with
the opening whisper. The first startle latches it off through the laugh, ending
speech, second scare and idle; only the next approach releases that latch.
Existing "Katso tanne" whisper draws attention to the head. Reveal placement
uses the head's eye midpoint; viewer eye tracking remains the capture focus.
Style, enable, opacity, size and preview: ?debug=1 > Effects only.

Debug Effects includes hover/glow sliders and a persistent Lamp blinking toggle.
No fullscreen API is called; iPad display uses the installed web app manifest.

The native ghost canvas now feeds the main renderer before each live frame.
Camera, ghost (including its eyes), and lamps share identical morph/ripple/RGB
sample coordinates in WebGL and the CPU fallback. The ghost eye anchor is
projected through the green-channel warp for the startle placement.
