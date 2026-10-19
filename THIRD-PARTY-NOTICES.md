# Third-party notices

Revibe Media Centre's original source code is licensed under GPL-3.0-only. The third-party components listed here remain under their own licenses; their inclusion does not change those terms.

## HLS.js 1.7.3

The browser-side HLS playback asset is copied from the `hls.js` npm package during installation/build. HLS.js is copyright Dailymotion and contributors and is licensed under Apache License 2.0. The upstream notice is in [`LICENSES/HLS.JS-LICENSE.txt`](LICENSES/HLS.JS-LICENSE.txt); the full Apache license is in [`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).

Upstream: <https://github.com/video-dev/hls.js>

## music-metadata 11.x

Revibe uses `music-metadata` for local audio metadata. It is licensed under the MIT License. The upstream license text is in [`LICENSES/MUSIC-METADATA-LICENSE.txt`](LICENSES/MUSIC-METADATA-LICENSE.txt).

Upstream: <https://github.com/Borewit/music-metadata>

## Electron and Chromium

The Windows desktop build bundles Electron and Chromium. Electron is distributed under the MIT License; its license text is in [`LICENSES/ELECTRON-LICENSE.txt`](LICENSES/ELECTRON-LICENSE.txt). Chromium and other runtime components have their own notices, which Electron Builder includes with the packaged runtime (including `LICENSES.chromium.html`).

Upstream: <https://github.com/electron/electron>

## Build-time tools

Vite and Electron Builder are build/development dependencies and are not application code. Their npm packages provide their respective license files when installed.

## TV directory data and streams

Revibe does not host or own the TV channels or stream endpoints shown in its guide. The fallback catalog is a small set of public directory records and third-party stream references; data and provider terms can differ. IPTV-Org is an independent community project and is not affiliated with Revibe. See <https://github.com/iptv-org/iptv> and <https://github.com/iptv-org/database> for its source data and licensing information.
