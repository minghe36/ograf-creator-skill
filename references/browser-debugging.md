# Browser debugging workflow

## Start the debugger

From any working directory:

```bash
node <skill-dir>/scripts/ograf_dev_server.mjs <graphic-directory> --port 4173
```

Keep the process alive in a persistent terminal session. If port 4173 is occupied, choose another unprivileged port. The server prints an exact URL such as:

```text
http://127.0.0.1:4173/__ograf__/debug
```

The server binds to loopback by default. Do not expose it to a network unless the user explicitly asks.

## Use a real browser

Open the URL with the available browser/computer-use tool. Prefer a visible browser so the user can observe the work. Use the page UI instead of injecting code into the iframe; this preserves the same sandbox boundary as `OgrafContainer`.

The debugger deliberately uses:

- `sandbox="allow-scripts"` without `allow-same-origin`;
- `postMessage('*')` for commands;
- `event.source === iframe.contentWindow` and opaque-origin checks for events;
- schema controls sourced from `project.json`;
- a scaled stage at the declared design resolution.

## Verification pass

1. Wait for the status badge to become **Ready**. A mere iframe `load` is not proof of readiness.
2. Click **Start**. Confirm the intended entrance, timing, typography, clipping, and final frame.
3. Click **Stop**. Confirm timers are cancelled and the resting state is correct.
4. Click **Start** again. Confirm replay begins from the same initial frame.
5. Change every schema field. Confirm the preview updates without iframe navigation or reload.
6. Test numeric minima/maxima, empty strings, long text, special characters, and transparent/edge colors where applicable.
7. Click **Reload**, wait for Ready, and repeat Start once.
8. Inspect visible diagnostics and browser console errors. Treat `ograf:error`, uncaught exceptions, failed resources, and invalid form JSON as failures.
9. Switch Canvas between Landscape 1920×1080 and Portrait 1080×1920, then resize the viewport. Verify both text layouts and fit without reloading.
10. Exercise the native main.js entry separately with load resolution 1080×1920 while the host box stays 1920×1080. Confirm the stage is a body child at 1080×1920 and scale 1. Check goToTime/schedule backward seeks, dispose, disconnect and reconnect.

When the graphic has a defined duration, verify `ograf:ended` arrives at the expected time. A deliberately looping graphic may omit it, but document that behavior.

## Diagnose common failures

- **Stuck at Loaded/Waiting:** the graphic did not emit `ograf:ready`, emitted it before installing handlers, or threw during initialization.
- **Form changes do nothing:** the schema key differs from the runtime key, or `ograf:update` is not handled.
- **Replay jumps:** the previous Web Animation, timeout, or animation frame was not cancelled before start.
- **Works outside debugger only:** the graphic depends on same-origin access, parent DOM access, or an undeclared network resource.
- **Blank frame with no error:** add global `error` and `unhandledrejection` forwarding to `ograf:error` and verify local asset paths.
- **Correct preview, rejected upload:** validate and pack with `ograf_tool.py`; ensure required files are at ZIP root and the archive is within limits.
