Sheet ghost v1

Artwork: generated from the selected option 8 concept. No mouth or added pupils.
sheet-loop.mp4 is a silent procedural animation of sheet-ghost.png, not AI video.
Rebuild: python scripts/render-ghost-loop.py (Pillow, NumPy, SciPy, ffmpeg).
8 seconds, 24fps, H.264/yuv420p; all motion is periodic with no duplicated endpoint.
The black matte uses CSS screen blending to show the camera through the ghost.

The separate ghost canvas never enters face tracking or portrait capture.
It appears at the opening whisper, hides during both scares and the laugh,
and returns for the ending. Existing "Katso tanne" audio draws attention to it.
The scare is aligned to the ghost's eye midpoint while the ghost is visible.
Enable, opacity, size and preview are available only in ?debug=1 > Effects.
