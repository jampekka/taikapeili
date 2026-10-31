Floating ghost heads v2

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
The head fills the centre of the mirror. Actual whisper/ending playback also
shows it outside automatic sequence states. Ghost defaults migrate once to
revision 3 (enabled, 90% opacity, 115% size); subsequent operator edits persist.

Separate canvas never enters face tracking or portrait capture. Appears with
the opening whisper, clears for both scares and laugh, returns for the ending.
Existing "Katso tanne" whisper draws attention to the head. Reveal placement
uses the head's eye midpoint; viewer eye tracking remains the capture focus.
Style, enable, opacity, size and preview: ?debug=1 > Effects only.
