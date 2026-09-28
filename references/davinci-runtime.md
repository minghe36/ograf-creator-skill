# DaVinci body portal and resolution

Create `main.js` exporting a class that extends `HTMLElement`, plus one named `.ograf.json` whose `main` points to it. Keep `project.json` and `index.html` for website upload and portable postMessage preview. Both entry paths use the same runtime; do not maintain two animations. The starter uses a classic runtime script for opaque-origin HTML preview, and an ES module main entry for native OGRAF.

## Visible stage belongs to body

The host component can sit inside a fixed 1920×1080 wrapper even when the DaVinci timeline is portrait. Create a separate stage/portal with `document.body.append(portal)`. Scope styles inside its shadow root. Make it fixed, transparent, pointer-events:none, with transform-origin:0 0. Query the portal's shadow root after moving the visual tree, not the host's old shadow tree.

Determine canvas width/height from `load({renderCharacteristics})` → `renderCharacteristics.resolution.width/height`. Use the actual iframe viewport only when no resolution was supplied. Never derive a supplied portrait resolution from the host element's client size or window.innerWidth.

For a real host box matching the render canvas aspect ratio (within 2%), fit the entire canvas uniformly and center it inside that box. If the box has a different aspect ratio, as with a stale DaVinci landscape wrapper, retain the requested canvas dimensions at 1:1 starting at body origin. Do not letterbox the portrait canvas into the stale wrapper. ResizeObserver and window resize must recompute fit without replaying.

Adapt the animation layout itself for landscape and portrait: safe margins, text wrapping and suitable scaling. A portal alone does not guarantee portrait layout. Declare supportsLandscape/supportsPortrait only after previewing those layouts.

Remove the portal, observers, resize listeners and animation frames on disconnectedCallback/dispose. Reconnecting creates one stage, with no orphan or duplicate portals.

## Native lifecycle

Implement load, updateAction, playAction, stopAction and dispose with OGRAF response payloads (statusCode and currentStep). The native manifest's schema.properties must match project.json.schema and defaults/data. Use renderRequirements resolution ideal constraints rather than enforcing one orientation with exact values.

When declaring supportsNonRealTime:true, implement goToTime({timestamp}) (milliseconds) and setActionsSchedule({schedule}). Render deterministic frames from the timestamp, including scheduled update/play/stop events. Test backward and repeated seeks; do not derive exported frames from wall-clock CSS animation progress. Do not advertise unsupported custom actions.

The HTML adapter maps all six postMessage lifecycle messages to the same native runtime. An optional renderCharacteristics value on preview update messages provides a debug canvas override; it is a preview extension, not one of the standard six messages. Keep same-origin access unnecessary.

## Reference implementation

Patterns verified against HaoOG-ograf's `1/29/整行字幕基础/main.js` and `14/47/圆环扩散/main.js`: _configureStage, body portal, aspect-matched fit, load renderCharacteristics and cleanup. Those files are development references, not external runtime dependencies for generated packages.
