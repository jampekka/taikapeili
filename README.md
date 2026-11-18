# The Other Side — Haunted Mirror

A haunted mirror for your browser: Finnish whispers, a ghost that follows your face, rippling reflections, and a final jump scare. Made for a camera-equipped screen, especially an iPad.

**No humans were bothered writing or reading this code.**

## Use it

1. Open the mirror, enable sound, and tap **Avaa peili** (“Open the mirror”) when prompted.
2. Allow camera access and place the screen where it can see your face.
3. Follow the Finnish whispers: move closer and look into the ghost’s eyes. The rest runs automatically.
4. Step out of view before the next person approaches.

On iPad, open it in Safari and choose **Share → Add to Home Screen** for a standalone mirror.

Append `?debug=1` to the app URL to adjust volume, camera framing, effects, and the scare. Settings stay in that browser; other devices have their own settings. After tuning, select **Run mirror** to enter the public view. You can also add the debug page to the Home Screen as a separate operator shortcut.

## Run locally

Use Node.js 22 or newer. No npm dependencies or API keys are needed.

```sh
git clone https://github.com/jampekka/haunted-mirror.git
cd haunted-mirror
npm run build
npm run dev
```

Open [localhost:4173](http://localhost:4173/) or [local debug mode](http://localhost:4173/?debug=1). Camera access requires HTTPS when opening the app from another device.

## How it works

Face tracking, camera effects, and audio playback happen in the browser. Camera images stay in browser memory. Models, sounds, and artwork are bundled; this version makes no remote image-generation calls.

The live app is served behind Caddy. The original app code and behavior are preserved.

See the [technical notes](docs/TECHNICAL.md) for behavior and validation details, and the [vendor notices](assets/vendor/NOTICE.txt), [audio sources](assets/audio/SOURCES.txt), and [ghost artwork notes](assets/ghost/README.txt) for bundled asset credits.
