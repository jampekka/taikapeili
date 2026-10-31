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
The runtime draws only the real RGBA PNG cutout using normal blending, with
no cast shadow or opaque H.264 video matte. Animation comes from native hover,
zoom, eye following and the shared morph/ripple warp. The MP4s are retained
source experiments and are not loaded by the mirror.
The head fills the centre of the mirror, with bounded native hover and small
tiny round glowing eye points and a subtle +/-2.5% zoom cycle. Eye fixations last about 3.4s with 140ms gaze shifts.
Opacity follows the live speech analyser with an 8-second exponential sound-level smoothing constant.
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

Eyes and glow are painted into the head layer before its single shared opacity
is applied, so they fade exactly with the apparition instead of overdraw.

Tracked-eye alignment: the eye pair's midpoint and roll drive a smoothed rigid
translation/rotation. By default tracking applies no scale, keeping configured size fixed. Optional
Match eye spacing also follows eye distance, with a default minimum tracking
size of 65% of the configured head. While following eyes, the independent hover/zoom
pose yields to that alignment. Eye sparkle motion is included in the alignment
anchor. With no tracked eyes, the existing idle hover/zoom remains available.

Close width is now a fraction of intrinsic ghost face width (measured across
the sheet at eye height), default 80%. A closeReference marker migrates saved
screen-width thresholds to the new default. Detection area in debug Effects
expands the scan from the displayed crop to the full camera without reframing
the mirror. Scan geometry travels with the in-flight result. Complete eye outlines still control ghost tracking, but do not gate narration.
The first detected face immediately starts the full Psst opening and sequence;
clipped eyes never restart it.

Position, shortest-path rotation and optional scale share a frame-rate-independent
EMA (Tracking smoothing, default 0.45 seconds). Valid on-screen eye samples carry
their arrival time, so stale results cannot hold the pose forever. After 1.5s
without visible eyes, the target becomes the default pose and the same EMA tails
back to it. Pre-startle approach restarts preserve the tail; a real startle clears
and suppresses the entire apparition until the next sequence.
