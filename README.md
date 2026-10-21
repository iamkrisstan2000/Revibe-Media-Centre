# Revibe Media Centre

A local-first desktop app for your music, videos, and an optional guide to community-listed TV streams.

**Version:** 1.1.0 · **License:** GPL-3.0-only

Enjoying Revibe? [Give the project a little support on Ko-fi](https://ko-fi.com/N7D7292WUD) ☕ It helps keep the app maintained—thank you!

## Features

- **Music:** scan selected folders, manage queues, view embedded or nearby cover art, and use shuffle, EQ, reverb, crossfade, and the Minimal Viz.
- **Video:** play local files and manage a drag-and-drop queue.
- **TV:** browse publicly listed streams supplied by third parties. Revibe does not host or control them.
- **Personalize:** choose themes and accents; Windows backdrop materials and rounded corners are used where supported. Low graphics mode is optional.
- **Private by default:** media stays on your device. Revibe scans only folders you choose, unless removable-drive discovery is enabled in Settings.

## Run from source

Requires Node.js 22.12 or newer. For the desktop app and Windows packages, use Windows 10/11 x64.

```sh
npm ci
npm run check
npm run dev
```

Open the local Vite address shown in the terminal to preview the interface. To start the Electron desktop app, use another terminal:

```sh
npm start
```

Build the renderer with `npm run build:web`.

## Build Windows packages

On Windows x64, run:

```sh
npm ci
npm run installer:win
```

The NSIS Setup installer is written to `release/`. It includes a license page, installation-folder choice, Start menu and desktop shortcuts, and the supported media file associations. Windows still controls the user's default-app choice; select Revibe under **Open with** or **Default apps** if needed.

For a portable build, run `npm run portable:win`. The GitHub Actions workflow can also build both packages when manually started or when a `v*` tag is pushed. The Setup is over GitHub's 100 MB per-file repository limit; publish it as a Release asset or Actions artifact instead of committing it.

### Supported Windows file associations

- **Audio (13):** `.mp3`, `.m4a`, `.aac`, `.wav`, `.flac`, `.ogg`, `.oga`, `.opus`, `.wma`, `.aiff`, `.aif`, `.ape`, `.alac`
- **Video (12):** `.mp4`, `.m4v`, `.mkv`, `.webm`, `.mov`, `.avi`, `.wmv`, `.mpeg`, `.mpg`, `.3gp`, `.ts`, `.m2ts`

## Privacy and licensing

Online artwork lookups may send a media title and, when available, an artist or channel name to the lookup service. TV listings and streams come from third parties and may be unavailable or restricted. Playback depends on codecs provided by Electron/Chromium.

Revibe Media Centre is free software under the **GNU General Public License v3.0 only** (`GPL-3.0-only`); see [`LICENSE`](LICENSE). Third-party notices and licenses are in [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) and [`LICENSES/`](LICENSES/).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Before submitting changes, run `npm run check` and `npm run build:web`.
