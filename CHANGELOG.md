# Changelog

## 1.1.0 — 2026-10-21

- Promoted the confirmed v1.0.9 artwork recovery into the official release; existing libraries continue to rescan local covers and show the vinyl fallback when no artwork is available.
- Reduced unnecessary renderer work: reuse unchanged artwork elements, update only the affected queue or channel list, and skip duplicate list renders during startup and queue creation/refresh.
- Prepared the Windows x64 NSIS Setup installer with a license page, installation-folder choice, shortcuts, and the existing audio/video file associations.
- Simplified the README and added a small, friendly Ko-fi support link.

## 1.0.9 — 2026-10-21

- Clear stale cached music-art references once after upgrading, then rescan local sidecar and embedded covers so missing art reaches the vinyl fallback.

## 1.0.8 — 2026-10-21

- Prefetch sidecar and embedded cover art for detected local music with a bounded three-worker queue; repeated embedded covers are deduplicated by image content.
- Added a Fluent-inspired vinyl-cover fallback for music artwork, kept visible while covers load and whenever none can be shown.
- Kept online artwork searches viewport-lazy to avoid sending a burst of requests for a large library, and corrected the malformed artwork CSS rule.

## 1.0.7 — 2026-10-21

- Removed the shadow spill at the titlebar/navigation seam; kept the navigation shadow below the navigation only.
- Increased player-bar transparency by 1.6 percentage points in light mode and 2.5 percentage points in dark mode.
- Prepared an updated Windows portable test build.

## 1.0.6 — 2026-10-21

- Moved the subtle shadow below the top navigation and unified titlebar/navigation translucency with a shared, theme-aware surface.
- Prepared a temporary Windows portable executable for quick testing.

## 1.0.5 — 2026-10-21

- Added a restrained, theme-aware shadow beneath the titlebar while keeping its divider removed and the navigation's own border intact.
- Bounded artwork and sidecar-image caches, stopped observing artwork in hidden pages, and pruned stale renderer item references.
- Create the reverb convolution buffer only when reverb is enabled, then release it after the effect is turned off.
- Removed an unused confirmation-state variable and an unused artwork-layout parameter.

## 1.0.4 — 2026-10-21

- Enabled native rounded window corners on supported Windows 11 systems while keeping the DWM system backdrop path available.
- Removed the divider line between the custom titlebar and top navigation.

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
