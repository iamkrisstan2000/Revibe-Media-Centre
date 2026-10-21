# Revibe Media Centre

A local-first desktop app for your music, videos, and an optional guide to community-listed TV streams.

**Version:** 1.1.0 · **License:** GPL-3.0-only


## Screenshots 

<img width="1919" height="1079" alt="Screenshot 2026-10-21 204139" src="https://github.com/user-attachments/assets/1b5b80d5-4db1-47c7-bf1b-0cee94eb97c7" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204122" src="https://github.com/user-attachments/assets/4130bccd-83ad-499d-833c-02cbef9b2ff7" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204112" src="https://github.com/user-attachments/assets/652383d4-b6d7-4ee3-b926-2022cd5325aa" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204100" src="https://github.com/user-attachments/assets/3c861ea8-57e5-40da-86a7-f5ed75618a0d" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204054" src="https://github.com/user-attachments/assets/d55faf73-ead4-4a81-a0fa-26a3cf6fe1de" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204048" src="https://github.com/user-attachments/assets/eb63a95d-5f4b-4b29-af4c-7f49c4a4f3f8" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204027" src="https://github.com/user-attachments/assets/4bd93806-7071-4985-b6f9-ed8e41ff8272" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 204014" src="https://github.com/user-attachments/assets/ff0eb736-8fee-45b5-bb51-4f37098a4486" />
<img width="1918" height="1067" alt="Screenshot 2026-10-21 204009" src="https://github.com/user-attachments/assets/3fc82d65-4a44-4ae2-890b-178fbb0f9360" />
<img width="1916" height="1076" alt="Screenshot 2026-10-21 204004" src="https://github.com/user-attachments/assets/4a391342-2e6d-42d0-8a03-3329725e1f8b" />
<img width="1919" height="1070" alt="Screenshot 2026-10-21 204000" src="https://github.com/user-attachments/assets/caec0063-0aae-4789-8091-e738545d04fd" />
<img width="1919" height="1079" alt="Screenshot 2026-10-21 203955" src="https://github.com/user-attachments/assets/f5b7f03a-67c3-4e05-858d-c5be1aaad9b0" />


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
