import { LitElement, html, css, nothing, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { renderChair } from './chair.js';
import {
  HomeAssistant,
  RecliningCardConfig,
  Zone,
  Level,
  Theme,
  MotorKey,
  RecliningState,
  ZONES,
  ZONE_LABEL,
  HA_TOKENS,
} from './types.js';

const VERSION = '0.1.2';

const RAMP_TICK_MS = 30;
const RAMP_STEP = 0.025;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const reclineLabelFor = (pct: number): string => {
  if (pct < 10) return 'Upright';
  if (pct < 40) return 'Reclined';
  if (pct < 80) return 'Lounge';
  return 'Flat';
};

@customElement('recliner-card')
export class RecliningCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config!: RecliningCardConfig;

  @state() private _local: RecliningState = {
    recline: 0,
    footrest: 0,
    lift: 0,
    heat: false,
    zones: { back: 0, lumbar: 0, thigh: 0, leg: 0 },
    moving: null,
  };

  @state() private _activeZone: Zone | null = null;
  @state() private _gestureKey: MotorKey | null = null;

  private _rampHandle: number | null = null;
  private _holdEnvelope: { mkey: MotorKey; otherKey: MotorKey | null } | null = null;
  private _sliderEl: HTMLElement | null = null;
  private _slidePointerId: number | null = null;
  private _lastReleasedAt = 0;

  public setConfig(config: RecliningCardConfig): void {
    if (!config) throw new Error('Invalid configuration');
    this._config = { name: 'Recliner', ...config };
  }

  public getCardSize(): number {
    return 5;
  }

  public static getStubConfig(): Partial<RecliningCardConfig> {
    return {
      name: 'Living Room Recliner',
      recline_entity: 'cover.recliner_back',
      footrest_entity: 'cover.recliner_footrest',
      lift_entity: 'cover.recliner_lift',
      heat_entity: 'switch.recliner_heat',
      massage_zones: {
        back: 'select.recliner_massage_back',
        lumbar: 'select.recliner_massage_lumbar',
        thigh: 'select.recliner_massage_thigh',
        leg: 'select.recliner_massage_leg',
      },
    };
  }

  private get _theme(): Theme {
    const cfg = this._config?.theme;
    if (cfg === 'dark' || cfg === 'light') return cfg;
    const dark = this.hass?.themes && (this.hass.themes as { darkMode?: boolean }).darkMode;
    return dark ? 'dark' : 'light';
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (!this.hass || !this._config) return;
    if (changed.has('hass') && this._gestureKey === null && Date.now() - this._lastReleasedAt > 500) {
      this._syncFromHass();
    }
  }

  private _coverPos(entityId: string | undefined): number | null {
    if (!entityId || !this.hass) return null;
    const st = this.hass.states[entityId];
    if (!st) return null;
    const domain = this._domainOf(entityId);
    if (domain === 'input_number' || domain === 'number' || domain === 'sensor') {
      const num = Number(st.state);
      if (Number.isFinite(num)) return clamp01(num / 100);
      return null;
    }
    const pos = st.attributes?.current_position;
    if (typeof pos === 'number') return clamp01(pos / 100);
    if (st.state === 'open') return 1;
    if (st.state === 'closed') return 0;
    return null;
  }

  private _switchOn(entityId: string | undefined): boolean {
    if (!entityId || !this.hass) return false;
    return this.hass.states[entityId]?.state === 'on';
  }

  private _selectLevel(entityId: string | undefined): Level {
    if (!entityId || !this.hass) return 0;
    const st = this.hass.states[entityId];
    if (!st) return 0;
    const opts: string[] = (st.attributes?.options as string[]) ?? [];
    const idx = opts.indexOf(st.state);
    if (idx < 0) {
      const num = Number(st.state);
      if (Number.isFinite(num) && num >= 0 && num <= 3) return num as Level;
      return 0;
    }
    return Math.max(0, Math.min(3, idx)) as Level;
  }

  private _syncFromHass(): void {
    const c = this._config;
    const next: RecliningState = {
      recline: this._coverPos(c.recline_entity) ?? this._local.recline,
      footrest: this._coverPos(c.footrest_entity) ?? this._local.footrest,
      lift: this._coverPos(c.lift_entity) ?? this._local.lift,
      heat: this._switchOn(c.heat_entity),
      zones: {
        back: this._selectLevel(c.massage_zones?.back),
        lumbar: this._selectLevel(c.massage_zones?.lumbar),
        thigh: this._selectLevel(c.massage_zones?.thigh),
        leg: this._selectLevel(c.massage_zones?.leg),
      },
      moving: null,
    };
    this._local = next;
  }

  private _setLocal(patch: Partial<RecliningState>): void {
    this._local = { ...this._local, ...patch };
  }

  private _onSliderDown = (e: PointerEvent): void => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    this._sliderEl = el;
    this._slidePointerId = e.pointerId;
    el.setPointerCapture(e.pointerId);
    this._gestureKey = 'recline';
    this._setLocal({ moving: 'recline' });
    this._updateSlider(e.clientY);
    el.addEventListener('pointermove', this._onSliderMove);
    el.addEventListener('pointerup', this._onSliderUp);
    el.addEventListener('pointercancel', this._onSliderUp);
  };

  private _onSliderMove = (e: PointerEvent): void => {
    if (e.pointerId !== this._slidePointerId) return;
    this._updateSlider(e.clientY);
  };

  private _onSliderUp = (e: PointerEvent): void => {
    if (e.pointerId !== this._slidePointerId) return;
    const el = this._sliderEl;
    if (el) {
      try { el.releasePointerCapture(e.pointerId); } catch (_err) { /* noop */ }
      el.removeEventListener('pointermove', this._onSliderMove);
      el.removeEventListener('pointerup', this._onSliderUp);
      el.removeEventListener('pointercancel', this._onSliderUp);
    }
    this._sliderEl = null;
    this._slidePointerId = null;
    this._gestureKey = null;
    this._lastReleasedAt = Date.now();
    this._setLocal({ moving: null });
    this._commitCover(this._config.recline_entity, this._local.recline);
  };

  private _updateSlider(clientY: number): void {
    const el = this._sliderEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const t = clamp01((clientY - rect.top) / rect.height);
    this._setLocal({ recline: t, moving: 'recline' });
  }

  private _startHold(mkey: MotorKey, otherKey: MotorKey | null): void {
    if (this._rampHandle !== null) clearInterval(this._rampHandle);
    this._gestureKey = mkey;
    this._holdEnvelope = { mkey, otherKey };
    this._setLocal({ moving: mkey });
    this._dispatchHoldStart(mkey, otherKey);
    this._rampHandle = window.setInterval(() => this._tickHold(), RAMP_TICK_MS);
  }

  private _tickHold(): void {
    if (!this._holdEnvelope) return;
    const { mkey, otherKey } = this._holdEnvelope;
    const cur = this._local;
    if (otherKey && cur[otherKey] > 0.001) {
      this._setLocal({ [otherKey]: Math.max(0, cur[otherKey] - RAMP_STEP), moving: mkey } as Partial<RecliningState>);
      return;
    }
    if (cur[mkey] < 0.999) {
      this._setLocal({ [mkey]: Math.min(1, cur[mkey] + RAMP_STEP), moving: mkey } as Partial<RecliningState>);
    }
  }

  private _stopHold(): void {
    if (this._rampHandle !== null) {
      clearInterval(this._rampHandle);
      this._rampHandle = null;
    }
    const env = this._holdEnvelope;
    this._holdEnvelope = null;
    this._gestureKey = null;
    this._lastReleasedAt = Date.now();
    this._setLocal({ moving: null });
    if (env) this._dispatchHoldStop(env.mkey, env.otherKey);
  }

  private _entityFor(key: MotorKey): string | undefined {
    const c = this._config;
    return key === 'recline' ? c.recline_entity : key === 'footrest' ? c.footrest_entity : c.lift_entity;
  }

  private _writePosition(entityId: string, value01: number): void {
    const pos = Math.round(clamp01(value01) * 100);
    const domain = this._domainOf(entityId);
    if (domain === 'input_number' || domain === 'number') {
      this._callService(domain, 'set_value', { entity_id: entityId, value: pos });
    } else {
      this._callService('cover', 'set_cover_position', { entity_id: entityId, position: pos });
    }
  }

  private _writeStop(entityId: string): void {
    const domain = this._domainOf(entityId);
    if (domain === 'cover') {
      this._callService('cover', 'stop_cover', { entity_id: entityId });
    }
    // input_number/number have no stop concept — last set_value sticks
  }

  private _dispatchHoldStart(mkey: MotorKey, otherKey: MotorKey | null): void {
    const target = this._entityFor(mkey);
    if (target) this._writePosition(target, 1);
    if (otherKey) {
      const otherEnt = this._entityFor(otherKey);
      const otherVal = this._local[otherKey];
      if (otherEnt && otherVal > 0.01) {
        this._writePosition(otherEnt, 0);
      }
    }
  }

  private _dispatchHoldStop(mkey: MotorKey, otherKey: MotorKey | null): void {
    for (const key of [mkey, otherKey].filter((k): k is MotorKey => !!k)) {
      const ent = this._entityFor(key);
      if (!ent) continue;
      this._writeStop(ent);
      this._writePosition(ent, this._local[key]);
    }
  }

  private _commitCover(entityId: string | undefined, value01: number): void {
    if (!entityId) return;
    this._writePosition(entityId, value01);
  }

  private _domainOf(entityId: string): string {
    return entityId.split('.', 1)[0];
  }

  private _toggleHeat = (): void => {
    this._setLocal({ heat: !this._local.heat });
    const ent = this._config.heat_entity;
    if (!ent) return;
    this._callService(this._domainOf(ent), 'toggle', { entity_id: ent });
  };

  private _cycleZone = (zone: Zone): void => {
    const cur = this._local.zones[zone] ?? 0;
    const next: Level = ((cur + 1) % 4) as Level;
    this._setLocal({ zones: { ...this._local.zones, [zone]: next } });
    this._activeZone = zone;
    const ent = this._config.massage_zones?.[zone];
    if (!ent || !this.hass) return;
    const opts: string[] = (this.hass.states[ent]?.attributes?.options as string[]) ?? [];
    const option = opts[next] ?? String(next);
    this._callService(this._domainOf(ent), 'select_option', { entity_id: ent, option });
  };

  private _callService(domain: string, service: string, data: Record<string, unknown>): void {
    if (!this.hass) return;
    this.hass.callService(domain, service, data);
  }

  protected override render(): TemplateResult {
    if (!this._config || !this.hass) return html``;
    const t = this._theme;
    const c = HA_TOKENS[t];
    const s = this._local;
    const reclinePct = Math.round(s.recline * 100);
    const footPct = Math.round(s.footrest * 100);
    const liftPct = Math.round(s.lift * 100);
    const inclineLabel = reclineLabelFor(reclinePct);
    const moving = !!s.moving;

    const root: Record<string, string> = {
      '--rc-bg': c.bg,
      '--rc-card': `var(--ha-card-background, var(--card-background-color, ${c.card}))`,
      '--rc-card-elev': c.cardElev,
      '--rc-text': `var(--primary-text-color, ${c.text})`,
      '--rc-text-dim': `var(--secondary-text-color, ${c.textDim})`,
      '--rc-border': c.border,
      '--rc-border-strong': c.borderStrong,
      '--rc-accent': c.accent,
      '--rc-accent-soft': c.accentSoft,
      '--rc-heat': c.heat,
      '--rc-heat-soft': c.heatSoft,
      '--rc-track': c.track,
      '--rc-pill': c.pill,
      '--rc-pill-active': c.pillActive,
    };
    const styleStr = Object.entries(root).map(([k, v]) => `${k}: ${v}`).join('; ');

    return html`
      <ha-card style=${styleStr} class="rc-root">
        <div class="rc-shell">
          ${this._renderHeader(moving)}
          ${this._renderHero(s, reclinePct, inclineLabel, t)}
          ${this._renderActionRow(footPct, liftPct, s.heat)}
          ${this._renderMassageRow(s)}
        </div>
      </ha-card>
    `;
  }

  private _renderHeader(moving: boolean): TemplateResult {
    const subtitle = this._config.subtitle ?? 'Online';
    return html`
      <div class="rc-header">
        <div class="rc-header-text">
          <div class="rc-title">${this._config.name}</div>
          <div class="rc-subtitle">${subtitle}</div>
        </div>
        <div class="rc-status">
          <div class="rc-dot ${moving ? 'on' : ''}"></div>
          <span class="rc-status-label">${moving ? 'Moving' : 'Idle'}</span>
        </div>
      </div>
    `;
  }

  private _renderHero(s: RecliningState, pct: number, label: string, theme: Theme): TemplateResult {
    return html`
      <div class="rc-hero">
        <div class="rc-slider-col">
          <div class="rc-mini-label">Up</div>
          <div class="rc-slider"
               @pointerdown=${this._onSliderDown}>
            <div class="rc-slider-fill"
                 style="height: ${s.recline * 100}%;
                        transition: ${s.moving ? 'none' : 'height .3s'};"></div>
            ${[0.25, 0.5, 0.75].map((tx) => html`
              <div class="rc-slider-tick" style="top: ${tx * 100}%;"></div>
            `)}
            <div class="rc-slider-thumb"
                 style="top: ${s.recline * 100}%;
                        transition: ${s.moving ? 'none' : 'top .3s'};"></div>
          </div>
          <div class="rc-mini-label">Flat</div>
        </div>

        <div class="rc-chair-wrap">
          ${renderChair({
            recline: s.recline,
            footrest: s.footrest,
            lift: s.lift,
            heat: s.heat,
            zones: s.zones,
            theme,
            size: 360,
            interactive: true,
            showHotspots: true,
            activeZone: this._activeZone,
            onZoneClick: (z: Zone) => { this._cycleZone(z); },
          })}
        </div>

        <div class="rc-readout">
          <div class="rc-readout-num">${pct}<span class="rc-readout-unit">%</span></div>
          <div class="rc-readout-label">${label}</div>
        </div>
      </div>
    `;
  }

  private _renderActionRow(footPct: number, liftPct: number, heat: boolean): TemplateResult {
    const heatLabel = heat ? 'On' : 'Off';
    return html`
      <div class="rc-actions">
        ${this._renderHoldBtn('Footrest', 'down', 'footrest', 'lift', footPct)}
        ${this._renderHoldBtn('Lift', 'up', 'lift', 'footrest', liftPct)}
        <button class="rc-btn rc-heat ${heat ? 'active' : ''}"
                @click=${this._toggleHeat}>
          <span class="rc-btn-icon">♨</span>
          <span class="rc-btn-label">Heat</span>
          <span class="rc-btn-state">${heatLabel}</span>
        </button>
      </div>
    `;
  }

  private _renderHoldBtn(
    label: string,
    iconDir: 'up' | 'down',
    mkey: MotorKey,
    otherKey: MotorKey,
    pct: number,
  ): TemplateResult {
    const moving = this._local.moving === mkey;
    const active = pct > 5;
    const start = (e: PointerEvent) => {
      e.preventDefault();
      const el = e.currentTarget as HTMLElement;
      try { el.setPointerCapture(e.pointerId); } catch (_err) { /* noop */ }
      this._startHold(mkey, otherKey);
    };
    const stop = () => this._stopHold();
    const arrowRotate = iconDir === 'down' ? 'rotate(180deg)' : 'none';
    return html`
      <div class="rc-btn rc-hold ${active ? 'active' : ''} ${moving ? 'moving' : ''}"
           @pointerdown=${start}
           @pointerup=${stop}
           @pointerleave=${stop}
           @pointercancel=${stop}>
        <div class="rc-hold-row">
          <svg class="rc-hold-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none"
               style="transform: ${arrowRotate};">
            <path d="M12 4 L12 20 M5 11 L12 4 L19 11"
                  stroke="currentColor" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="rc-btn-label">${label}</span>
        </div>
        <div class="rc-hold-pct">${pct}%</div>
      </div>
    `;
  }

  private _renderMassageRow(s: RecliningState): TemplateResult {
    return html`
      <div class="rc-massage">
        <span class="rc-massage-label">Massage</span>
        ${ZONES.map((zone) => {
          const lvl = s.zones[zone] ?? 0;
          const onMouseEnter = () => { this._activeZone = zone; };
          const onMouseLeave = () => { this._activeZone = null; };
          return html`
            <button class="rc-chip ${lvl ? 'on' : ''}"
                    @click=${() => this._cycleZone(zone)}
                    @mouseenter=${onMouseEnter}
                    @mouseleave=${onMouseLeave}>
              <span>${ZONE_LABEL[zone]}</span>
              <span class="rc-chip-dots">
                ${[0, 1, 2].map((i) => html`
                  <span class="rc-dot-mini ${i < lvl ? 'on' : ''}"></span>
                `)}
              </span>
            </button>
          `;
        })}
      </div>
    `;
  }

  static override styles = css`
    :host {
      display: block;
    }
    .rc-root {
      --rc-radius-card: 14px;
      --rc-radius-pill: 999px;
      box-sizing: border-box;
    }
    .rc-shell {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      box-sizing: border-box;
      color: var(--rc-text);
      font-family: var(--paper-font-body1_-_font-family, Roboto, Noto, Helvetica, Arial, sans-serif);
    }
    .rc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 44px;
    }
    .rc-header-text { display: flex; flex-direction: column; gap: 2px; }
    .rc-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--rc-text);
      line-height: 1.1;
    }
    .rc-subtitle {
      font-size: 12px;
      font-weight: 400;
      color: var(--rc-text-dim);
    }
    .rc-status { display: flex; align-items: center; gap: 8px; }
    .rc-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--rc-text-dim);
      transition: background .2s, box-shadow .2s;
    }
    .rc-dot.on {
      background: var(--rc-accent);
      box-shadow: 0 0 0 3px var(--rc-accent-soft);
    }
    .rc-status-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--rc-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .rc-hero {
      position: relative;
      display: flex;
      align-items: stretch;
      gap: 10px;
      background: var(--rc-card-elev);
      border: 1px solid var(--rc-border);
      border-radius: 14px;
      padding: 10px;
      min-height: 188px;
    }
    .rc-slider-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding-top: 2px;
    }
    .rc-mini-label {
      font-size: 9px;
      font-weight: 700;
      color: var(--rc-text-dim);
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    .rc-slider {
      position: relative;
      width: 26px;
      height: 156px;
      border-radius: 13px;
      background: var(--rc-track);
      border: 1px solid var(--rc-border);
      cursor: pointer;
      touch-action: none;
      box-sizing: border-box;
      overflow: hidden;
    }
    .rc-slider-fill {
      position: absolute;
      top: 0; left: 0; right: 0;
      background: linear-gradient(180deg, var(--rc-accent), var(--rc-accent-soft));
      border-radius: 12px 12px 0 0;
      opacity: 0.55;
    }
    .rc-slider-tick {
      position: absolute;
      left: 4px; right: 4px;
      height: 1px;
      background: var(--rc-border-strong);
      opacity: 0.4;
    }
    .rc-slider-thumb {
      position: absolute;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 32px; height: 12px;
      border-radius: 6px;
      background: var(--rc-accent);
      box-shadow: 0 2px 8px var(--rc-accent-soft);
      pointer-events: none;
    }
    .rc-chair-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-left: 8px;
      min-width: 0;
    }
    .rc-chair-wrap > svg {
      max-width: 100%;
      height: auto;
    }
    .rc-readout {
      position: absolute;
      top: 10px; right: 10px;
      background: var(--rc-bg);
      border: 1px solid var(--rc-border);
      border-radius: 10px;
      padding: 5px 9px;
      min-width: 64px;
      text-align: right;
    }
    .rc-readout-num {
      font-size: 17px;
      font-weight: 700;
      color: var(--rc-accent);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }
    .rc-readout-unit {
      font-size: 10px;
      font-weight: 500;
      color: var(--rc-text-dim);
      margin-left: 1px;
    }
    .rc-readout-label {
      font-size: 9px;
      font-weight: 600;
      color: var(--rc-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    .rc-actions {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .rc-btn {
      position: relative;
      cursor: pointer;
      user-select: none;
      touch-action: none;
      background: var(--rc-pill);
      color: var(--rc-text);
      border: 1px solid var(--rc-border);
      border-radius: 12px;
      padding: 10px 12px;
      min-height: 56px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
      font-family: inherit;
      transition: background .15s, border-color .15s, box-shadow .15s;
    }
    .rc-btn.active {
      background: var(--rc-accent-soft);
      border-color: var(--rc-accent);
      color: var(--rc-accent);
    }
    .rc-btn.moving {
      box-shadow: 0 0 0 3px var(--rc-accent-soft);
    }
    .rc-hold-row {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
    }
    .rc-hold-arrow {
      flex: 0 0 auto;
      color: inherit;
    }
    .rc-btn-label {
      font-size: 13px;
      font-weight: 600;
    }
    .rc-hold-pct {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-variant-numeric: tabular-nums;
      color: inherit;
      opacity: 0.8;
    }
    .rc-heat {
      align-items: center;
      flex-direction: row;
      justify-content: flex-start;
      gap: 8px;
      color: var(--rc-text);
    }
    .rc-heat .rc-btn-icon {
      font-size: 18px;
      line-height: 1;
    }
    .rc-heat .rc-btn-state {
      margin-left: auto;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--rc-text-dim);
    }
    .rc-heat.active {
      background: var(--rc-heat-soft);
      border-color: var(--rc-heat);
      color: var(--rc-heat);
    }
    .rc-heat.active .rc-btn-state { color: var(--rc-heat); }

    .rc-massage {
      background: var(--rc-card-elev);
      border: 1px solid var(--rc-border);
      border-radius: 12px;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .rc-massage-label {
      font-size: 11px;
      font-weight: 700;
      color: var(--rc-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-right: 4px;
    }
    .rc-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: transparent;
      border: 1px solid var(--rc-border);
      border-radius: 999px;
      padding: 5px 10px;
      cursor: pointer;
      font-family: inherit;
      color: var(--rc-text-dim);
      font-size: 11px;
      font-weight: 600;
    }
    .rc-chip.on {
      background: var(--rc-accent-soft);
      border-color: var(--rc-accent);
      color: var(--rc-accent);
    }
    .rc-chip-dots {
      display: inline-flex;
      gap: 2px;
    }
    .rc-dot-mini {
      width: 4px; height: 4px;
      border-radius: 2px;
      background: var(--rc-border-strong);
    }
    .rc-dot-mini.on {
      background: var(--rc-accent);
    }
  `;

  static {
    const w = window as unknown as { customCards?: unknown[] };
    w.customCards = w.customCards ?? [];
    w.customCards.push({
      type: 'recliner-card',
      name: 'Recliner Card',
      description: 'Powered recliner control with chair SVG, hold-to-move motors, heat and massage zones.',
      preview: false,
    });
    // eslint-disable-next-line no-console
    console.info(
      `%c RECLINER-CARD %c ${VERSION} `,
      'color:#fff;background:#286ec8;font-weight:700;padding:2px 6px;border-radius:3px 0 0 3px',
      'color:#286ec8;background:#fff;font-weight:700;padding:2px 6px;border-radius:0 3px 3px 0;border:1px solid #286ec8',
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'recliner-card': RecliningCard;
  }
}

export { nothing };
