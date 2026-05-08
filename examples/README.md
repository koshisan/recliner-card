# Examples

## `recliner_stub_package.yaml`

A self-contained HA package that creates fake `cover.*`, `switch.*`, and `select.*` entities backed by `input_number` / `input_boolean` / `input_select` helpers. Drop it into your `packages/` directory so you can wire up the card and see the UI without any real recliner hardware.

**Setup:**

1. In `configuration.yaml`:

   ```yaml
   homeassistant:
     packages: !include_dir_named packages
   ```

2. Place this file at `packages/recliner_stub.yaml`.

3. Restart HA. The following entities will appear:

   - `cover.recliner_back` / `cover.recliner_footrest` / `cover.recliner_lift`
   - `switch.recliner_heat`
   - `select.recliner_massage_{back,lumbar,thigh,leg}`

4. Add the card to a dashboard with the YAML in `lovelace.yaml`.

The covers reflect the underlying `input_number` value, so when the card calls `cover.set_cover_position` you'll see the position update — the chair SVG follows it 1:1. There's no motor, so `open_cover`/`close_cover`/`stop_cover` snap to extremes rather than ramping; that's fine for verifying that the gesture-to-service plumbing works.

## `lovelace.yaml`

Minimal card config pointing at the stub entities above. Paste into a dashboard in YAML mode, or copy the keys into the visual editor's *Manual Card* dialog.
