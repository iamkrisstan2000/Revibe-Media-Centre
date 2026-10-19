# Changelog

## 1.0.3 — 2026-10-18

- Added a Windows NSIS setup installer with a directory-selection wizard, GPLv3 license page, and Start menu/desktop shortcuts.
- Registered supported local audio and video formats for Windows Open with/Default apps and routed associated files into the appropriate player queue when launched.
- Windows retains control of the default-app choice; users can select Revibe in Default apps or Open with.

## 1.0.2 — 2026-10-18

- Low graphics mode now defaults to Off and is user-enabled from Settings. Updated its helper text to “Enable this if the app lags on your PC”.

## 1.0.1 — 2026-10-18

- Fixed background track transitions: crossfade gain curves are scheduled on the Web Audio clock instead of being stepped by `requestAnimationFrame`, which may be throttled when the window is behind another app.
- Added Low graphics mode with automatic detection for reduced-motion preferences, low-core-count/low-memory devices, and Intel HD/UHD graphics; the setting remains user-adjustable.
- Reduced visualizer canvas resolution and drawing complexity, capped animation at 24 fps in Low graphics mode and 30 fps otherwise, and stop the visualizer loop when Music is not visible or the app is hidden.
- Kept Windows Mica/Acrylic backdrop material enabled in Low graphics mode while disabling costly renderer-side blur/glow effects.
