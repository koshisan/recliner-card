# Recliner Card

A Lovelace card for Home Assistant to control a powered recliner with multiple motors and comfort features. Side-profile chair SVG that reflects live motor state, drag-slider for the backrest, hold-to-move buttons for footrest/lift, heat toggle, and per-zone massage chips.

![status: alpha](https://img.shields.io/badge/status-alpha-orange) ![hacs: custom](https://img.shields.io/badge/hacs-custom-blue)

## Features

- **Backrest** — vertical drag-slider (0% upright → 100% flat), live `%` readout with semantic label (Upright / Reclined / Lounge / Flat).
- **Footrest / Lift** — hold-to-move push buttons with mutually-exclusive sequencing: holding *Footrest* retracts *Lift* first; holding *Lift* retracts *Footrest* first.
- **Heat** — binary on/off, with pulsing radial overlay on the chair when active.
- **Massage** — 4 zones (Back, Lumbar, Thigh, Leg), each cycles 0 → 1 → 2 → 3. Hotspots are clickable directly on the chair *and* via the chip row.
- **Theme aware** — reads HA dark/light + canonical CSS custom properties (`--ha-card-background`, `--primary-text-color`, etc.) with curated fallback palette.
- **No external assets** — chair is rendered from SVG primitives. Single bundled JS file.

## Install (HACS, custom repository)

1. HACS → Frontend → ⋮ → **Custom repositories**.
2. Add `https://github.com/koshisan/recliner-card` as **Lovelace**.
3. Install **Recliner Card**.
4. Add the resource (HACS does this for you, but if you self-host: `/local/community/recliner-card/recliner-card.js`, type `module`).

## Install (manual)

```bash
mkdir -p /config/www/community/recliner-card
curl -L https://github.com/koshisan/recliner-card/releases/latest/download/recliner-card.js \
     -o /config/www/community/recliner-card/recliner-card.js
```

Then add to **Settings → Dashboards → Resources**:

- URL: `/local/community/recliner-card/recliner-card.js`
- Type: `JavaScript Module`

## Configuration

```yaml
type: custom:recliner-card
name: Living Room Recliner
subtitle: Living Room · Online
recline_entity:  cover.recliner_back
footrest_entity: cover.recliner_footrest
lift_entity:     cover.recliner_lift
heat_entity:     switch.recliner_heat
massage_zones:
  back:   select.recliner_massage_back
  lumbar: select.recliner_massage_lumbar
  thigh:  select.recliner_massage_thigh
  leg:    select.recliner_massage_leg
# theme: dark   # optional override; defaults to HA dark/light
```

| Option | Type | Default | Notes |
|--------|------|---------|-------|
| `name` | string | `Recliner` | Header title |
| `subtitle` | string | `Online` | Header subtitle |
| `recline_entity` | `cover.*` | — | `current_position` is read; `cover.set_cover_position` is called on slider release |
| `footrest_entity` | `cover.*` | — | hold-to-move drives toward 100; release calls `cover.stop_cover` |
| `lift_entity` | `cover.*` | — | as above |
| `heat_entity` | `switch.*` | — | tap toggles via `switch.toggle` |
| `massage_zones.{back,lumbar,thigh,leg}` | `select.*` | — | each select must expose 4 options (Off / 1 / 2 / 3 — labels are user-defined; level is mapped by *index*). `select.select_option` is called with `options[level]`. |
| `theme` | `dark` \| `light` | follows HA | Override only if you want to pin the chair palette regardless of HA theme |

### Wiring expectations

The card is wiring-agnostic but assumes a thin standard mapping:

| UI gesture | HA service call |
|------------|-----------------|
| Slider release | `cover.set_cover_position(entity_id=recline_entity, position=<0-100>)` |
| Hold *Footrest* press | `cover.set_cover_position(footrest, 100)` (+ `cover.set_cover_position(lift, 0)` if lift > 0) |
| Hold *Footrest* release | `cover.stop_cover` on whichever was moving, then `cover.set_cover_position` to commit final position |
| Heat tap | `switch.toggle(heat_entity)` |
| Massage chip / hotspot tap | `select.select_option(zone_entity, options[next_level])` |

If your motors don't expose `cover.set_cover_position`, write template covers or scripts that translate to whatever your hardware accepts (`open_cover`/`close_cover`/`stop_cover`, custom services, etc.).

### Testing without hardware

Drop in `examples/recliner_stub_package.yaml` from this repo as a `packages/` file. It defines `input_number`, `input_boolean`, and `input_select` helpers wrapped in template `cover` and `switch` entities so the card has something to talk to. See `examples/README.md`.

## Build

```bash
npm install
npm run build      # writes dist/recliner-card.js (minified ESM)
npm run watch      # rebuild on change
```

## Credits

Card design: V2 *Slider Dashboard* from a Claude Design handoff. Chair geometry, motor → transform mapping, and animation timings are from that spec.

## License

MIT
