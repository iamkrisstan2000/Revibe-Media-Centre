# Revibe Media Centre

Revibe Media Centre is a local-first desktop app for organizing and playing music and video, with an optional guide to publicly listed TV streams.

## Screenshots
<img width="1919" height="1079" alt="Screenshot 2026-10-17 185240" src="https://github.com/user-attachments/assets/eb49088d-3172-42bf-990d-fb1f29dae7f8" />
<img width="1919" height="1079" alt="Screenshot 2026-10-17 185233" src="https://github.com/user-attachments/assets/f4f79c80-3f24-4e0e-9e60-c937fa744176" />
<img width="1919" height="1079" alt="Screenshot 2026-10-17 185228" src="https://github.com/user-attachments/assets/e2e0057a-4eb8-4544-ae62-558e5f3f1db0" />
<img width="1919" height="1079" alt="Screenshot 2026-10-17 185223" src="https://github.com/user-attachments/assets/b762655e-698d-4275-b5ff-ea1f184a17f0" />
<img width="1919" height="1079" alt="Screenshot 2026-10-17 185217" src="https://github.com/user-attachments/assets/06deeff9-36ea-4cdf-87ad-3e5229ec43fb" />
<img width="1919" height="1079" alt="Screenshot 2026-10-17 185211" src="https://github.com/user-attachments/assets/70511bbb-cf38-4ef4-bed6-e3687ebb8a7f" />


## Features

- **Music:** scan folders you choose, manage a queue, view embedded or nearby artwork, and use shuffle, EQ, reverb, and the accent-colored Minimal Viz. Crossfade can be enabled or disabled, with 0.5, 0.8, 1, 1.5, 1.8, or 2-second transitions.
- **Video:** play local files from selected folders and manage a drag-and-drop queue.
- **TV:** browse a community-maintained directory of public streams. Revibe does not host or control those channels.
- **Devices:** detect removable drives in the Windows desktop app. Automatic media discovery is off by default and can be enabled in Settings.
- **Appearance:** light/dark/system themes, accent choices, and Windows backdrop materials where the OS supports them. Window corners use a near-square 2px renderer radius; native Windows corner rounding is opted out of so it does not impose a larger curve.
- **Local-first storage:** folder selections, queues, and preferences are kept in the app's user-data directory. Clearing app data does not remove media files.

## Requirements

- Node.js 22.12 or newer (npm is included with Node.js).
- Windows for the desktop app and Windows packaging. `npm run dev` can also preview the interface in a browser.
- Internet access for installing npm dependencies, refreshing the TV directory, and online artwork lookups. Local music and video files remain on the device.

## Run from source

From the project directory:

```sh
npm ci
npm run check
npm run dev
```

Open the local Vite address printed in the terminal to preview the interface. To run the desktop app, use a second terminal:

```sh
npm start
```

The install step downloads Electron and copies the pinned HLS.js browser asset into `assets/hls.min.js`. That generated asset is ignored by Git; it is recreated by `npm ci` or `npm run copy:hls`.

## Build for Windows

```sh
npm run build:win
```

Creates an unpacked application folder under `release/win-unpacked`. Keep that folder together when running the app.

```sh
npm run portable:win
```

Creates a portable Windows x64 launcher under `release/`. Build artifacts, dependencies, and generated files are excluded from the GitHub-ready source archive. The portable executable bundles Electron/Chromium and is therefore much larger than the source.

## Privacy and external services

- Revibe scans only the folders you select, except when you explicitly enable removable-drive discovery. It does not upload or delete your local music or video files.
- When online artwork is needed, Revibe may send a title and, when available, an artist or channel name to the relevant lookup service.
- The TV guide is based on public community data. Streams are served by third parties and can be unavailable, geo-restricted, or removed at any time. Revibe is not affiliated with IPTV-Org or the channel providers.
- Supported formats and playback depend on the codecs available in the installed Electron/Chromium runtime.

## Project layout

- `electron/` — desktop main process and restricted preload bridge.
- `src/` — application logic and styles.
- `assets/` — app icons and TV fallback data; `hls.min.js` is generated after install.
- `scripts/` — HLS asset preparation and source checks.
- `LICENSE` — GNU General Public License, version 3 only.
- `LICENSES/` and `THIRD-PARTY-NOTICES.md` — notices for bundled or runtime dependencies.

## Support Development

This application is free to use.

If you enjoy using it and would like to support
future development, voluntary donations are welcome.

Donations are entirely optional and are not required
to download or use this application.


## License

Revibe Media Centre is licensed under the **GNU General Public License v3.0 only** (`GPL-3.0-only`). See [`LICENSE`](LICENSE). Third-party components retain their own licenses; see [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md).

## Contributing

Issues and pull requests are welcome. Run `npm run check` before submitting a change. Please do not commit `node_modules/`, `dist/`, `release/`, or the generated `assets/hls.min.js` file.
