# Contributing

Thanks for your interest in improving Revibe Media Centre. Bug reports, thoughtful feature requests, and pull requests are welcome.

## Development setup

- Node.js 22.12 or newer, with npm.
- For the desktop app and Windows packaging, use Windows 10/11. Linux packaging is also possible with a compatible Wine installation; a Windows GitHub Actions workflow is provided for release builds.

From the repository root:

```sh
npm ci
npm run check
npm run build:web
```

To preview the interface, run `npm run dev`. To launch the Electron desktop app, run `npm start` after installing dependencies.

## Before submitting a change

- Run `npm run check` and `npm run build:web`.
- Keep generated output, installers, portable executables, media, and personal app data out of commits. The generated `assets/hls.min.js` is recreated by `npm ci`.
- Include clear reproduction steps for bugs. Do not attach private media or personal library data.
- Keep the app's existing privacy, accessibility, performance, and licensing behavior in mind.

Contributions are distributed under the project's **GPL-3.0-only** license. Please submit only work that you have the right to contribute under those terms.
