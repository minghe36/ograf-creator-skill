// Shared runtime for the native OGRAF component and HTML preview.
(() => {
  const defaults = { title: 'Hello OGraf', subtitle: 'Schema-driven HTML animation', accentColor: '#8b5cf6', panelColor: '#111827e8', position: 'left', fontSize: 72, holdSeconds: 3 };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  class Graphic extends HTMLElement {
    constructor() {
      super();
      this._data = { ...defaults };
      this._time = -1;
      this._raf = 0;
      this._playing = false;
      this._resolution = null;
      this._portal = null;
      this._resize = () => this._layout();
    }
    connectedCallback() {
      this._mount();
      addEventListener('resize', this._resize);
      this._observer = new ResizeObserver(this._resize);
      this._observer.observe(this);
    }
    disconnectedCallback() { this._cleanup(); }
    _mount() {
      if (this._portal) return;
      const portal = document.createElement('div');
      portal.dataset.ografStage = 'true';
      portal.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;overflow:hidden;background:transparent;transform-origin:0 0;z-index:2147483646';
      const scope = portal.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `*{box-sizing:border-box}.anchor{position:absolute;left:6%;bottom:8%;max-width:88%}.anchor.center{left:50%;transform:translateX(-50%)}.anchor.right{left:auto;right:6%}.card{display:grid;grid-template-columns:12px minmax(0,1fr);width:max-content;max-width:100%;filter:drop-shadow(0 18px 30px #0005);font-family:Arial,Helvetica,sans-serif}.accent{background:var(--accent);border-radius:10px 0 0 10px}.content{min-width:0;border-radius:0 16px 16px 0;background:var(--panel);padding:30px 42px;color:white}h1{margin:0;overflow-wrap:anywhere;font-size:var(--title-size);font-weight:800;line-height:1.1}p{margin:12px 0 0;overflow-wrap:anywhere;font-size:32px;line-height:1.25;white-space:pre-wrap}`;
      const anchor = document.createElement('div'); anchor.className = 'anchor';
      const card = document.createElement('div'); card.className = 'card';
      const accent = document.createElement('div'); accent.className = 'accent';
      const content = document.createElement('div'); content.className = 'content';
      this._title = document.createElement('h1'); this._subtitle = document.createElement('p');
      content.append(this._title, this._subtitle); card.append(accent, content); anchor.append(card); scope.append(style, anchor);
      this._portal = portal; this._anchor = anchor; this._card = card;
      document.body.append(portal);
      this._layout(); this._apply(); this._render(this._time);
    }
    _layout() {
      if (!this._portal) return;
      const requested = this._resolution;
      const width = Number(requested?.width) > 0 ? Number(requested.width) : innerWidth;
      const height = Number(requested?.height) > 0 ? Number(requested.height) : innerHeight;
      const rect = this.getBoundingClientRect();
      let fit = 1, left = 0, top = 0;
      // A stale landscape host must not shrink a portrait DaVinci canvas.
      if (rect.width >= 8 && rect.height >= 8 && Math.abs(rect.width / rect.height / (width / height) - 1) <= 0.02) {
        fit = Math.min(rect.width / width, rect.height / height);
        left = rect.left + (rect.width - width * fit) / 2;
        top = rect.top + (rect.height - height * fit) / 2;
      }
      Object.assign(this._portal.style, { width: width + 'px', height: height + 'px', left: left + 'px', top: top + 'px', transform: 'scale(' + fit + ')' });
      const scale = height > width ? Math.min(width / 1920, height / 1080) : height / 1080;
      this._card.style.zoom = String(scale);
      this._card.style.maxWidth = (width * 0.88 / scale) + 'px';
    }
    _apply() {
      if (!this._portal) return;
      const d = this._data;
      this._title.textContent = String(d.title ?? '');
      this._subtitle.textContent = String(d.subtitle ?? '');
      this._anchor.className = 'anchor ' + (['center', 'right'].includes(d.position) ? d.position : 'left');
      this._portal.style.setProperty('--accent', String(d.accentColor));
      this._portal.style.setProperty('--panel', String(d.panelColor));
      this._portal.style.setProperty('--title-size', clamp(Number(d.fontSize) || 72, 36, 120) + 'px');
    }
    _duration() { return 1.1 + clamp(Number(this._data.holdSeconds) || 3, 0.5, 10); }
    _render(time) {
      this._time = time;
      if (!this._portal) return;
      const end = this._duration(), enter = clamp(time / 0.65, 0, 1), exit = clamp((time - (end - 0.45)) / 0.45, 0, 1);
      this._card.style.opacity = String(time < 0 || time >= end ? 0 : Math.min(enter, 1 - exit));
      this._card.style.transform = 'translateY(' + ((1 - enter) * 52 - exit * 32) + 'px)';
    }
    _cancel() { cancelAnimationFrame(this._raf); this._raf = 0; this._playing = false; }
    _result() { return { statusCode: 200, currentStep: this._playing ? 1 : 0 }; }
    async load({ data, renderCharacteristics } = {}) {
      this._resolution = renderCharacteristics?.resolution || renderCharacteristics || this._resolution;
      this._mount(); this._layout();
      await this.updateAction({ data });
      await this.stopAction();
      await document.fonts.ready;
      return this._result();
    }
    async updateAction({ data } = {}) {
      if (data && typeof data === 'object') for (const key of Object.keys(defaults)) if (Object.hasOwn(data, key)) this._data[key] = data[key];
      this._apply(); this._render(this._time); return this._result();
    }
    async playAction() {
      this._cancel(); this._playing = true; this._render(0);
      const started = performance.now();
      const tick = () => {
        if (!this._playing) return;
        const time = (performance.now() - started) / 1000;
        this._render(time);
        if (time < this._duration()) this._raf = requestAnimationFrame(tick);
        else { this._playing = false; this.dispatchEvent(new Event('ograf-ended')); }
      };
      this._raf = requestAnimationFrame(tick); return this._result();
    }
    async stopAction() { this._cancel(); this._render(-1); return this._result(); }
    async setActionsSchedule({ schedule } = {}) {
      this._scheduleBase = { ...this._data };
      this._schedule = (Array.isArray(schedule) ? schedule : []).filter(item => Number.isFinite(item.timestamp) && ['updateAction', 'playAction', 'stopAction'].includes(item.action?.type)).map(item => ({ timestamp: item.timestamp, action: { type: item.action.type, params: { data: { ...item.action.params?.data } } } })).sort((a, b) => a.timestamp - b.timestamp);
      return {};
    }
    async goToTime({ timestamp = 0 } = {}) {
      this._cancel();
      const time = Math.max(0, Number(timestamp) || 0);
      this._data = { ...(this._scheduleBase || this._data) };
      let start = 0, stopped = false;
      for (const item of this._schedule || []) {
        if (item.timestamp > time) break;
        if (item.action.type === 'updateAction') {
          for (const key of Object.keys(defaults)) if (Object.hasOwn(item.action.params.data, key)) this._data[key] = item.action.params.data[key];
        } else if (item.action.type === 'playAction') { start = item.timestamp; stopped = false; }
        else stopped = true;
      }
      this._apply(); this._render(stopped ? -1 : (time - start) / 1000); return this._result();
    }
    _cleanup() {
      this._cancel(); this._observer?.disconnect(); removeEventListener('resize', this._resize);
      this._portal?.remove(); this._portal = null;
    }
    async dispose() { this._cleanup(); return this._result(); }
  }
  window.OgrafStarterGraphic = Graphic;
})();
