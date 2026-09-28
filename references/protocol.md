# Portable OGraf message protocol

The host treats the graphic as an opaque iframe. Communication is exclusively through `window.postMessage`; never read or modify `window.parent.document`.

## Host to graphic

```js
{ type: 'ograf:update', data: { /* schema values */ } }
{ type: 'ograf:start' }
{ type: 'ograf:stop' }
```

The host sends initial data after iframe load and may send later updates at any time. Unknown keys should be ignored safely. An update must not reload the document or implicitly restart the animation unless the graphic's documented behavior requires it.

## Graphic to host

```js
{ type: 'ograf:ready' }
{ type: 'ograf:ended' }
{ type: 'ograf:error', error: 'Human-readable diagnostic' }
```

Emit `ograf:ready` once DOM, fonts, local assets, event handlers, and the resting frame are ready. Emit `ograf:ended` after a non-looping play reaches its final frame. Convert uncaught errors and rejected promises to `ograf:error` where possible.

## Required implementation properties

- **Replayable start:** consecutive starts restart from a known frame, not from the current animation progress.
- **Deterministic stop:** cancel timers/animation frames and return to a consistent resting state.
- **Idempotent update:** applying the same data twice produces the same visible state.
- **No stale timers:** starting, stopping, or replaying must cancel work from the previous run.
- **Safe data handling:** render user text with `textContent`, not `innerHTML`.
- **Frame-rate independence:** use Web Animations, CSS animation, or elapsed time rather than assuming timer callbacks equal frames.

## Minimal receiver

```js
let currentData = {};
let animation = null;

function update(data) {
  currentData = { ...currentData, ...data };
  titleEl.textContent = String(currentData.title ?? '');
}

function stop() {
  animation?.cancel();
  animation = null;
  rootEl.style.opacity = '0';
}

function start() {
  stop();
  animation = rootEl.animate(
    [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 500, fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  animation.finished
    .then(() => parent.postMessage({ type: 'ograf:ended' }, '*'))
    .catch(() => {});
}

addEventListener('message', (event) => {
  const message = event.data;
  if (!message || typeof message !== 'object') return;
  if (message.type === 'ograf:update') update(message.data || {});
  if (message.type === 'ograf:start') start();
  if (message.type === 'ograf:stop') stop();
});

parent.postMessage({ type: 'ograf:ready' }, '*');
```

The `*` target is necessary for a sandboxed `srcdoc`, `file://`, or opaque-origin graphic. The host must still accept events only from the target iframe's `contentWindow`; the included debugger does this.
