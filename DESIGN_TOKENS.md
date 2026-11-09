# Design Tokens — Ontology Harness

**Policy:** transparent white + green only. Green is the single accent hue. Muted red/amber appear only for destructive/warning affordances. No other hues.

## Greens

| Token | Value | Use |
|---|---|---|
| `--green-50…900` | `#f0fdf4 → #14532d` | ramp for chips, bars, fills |
| `--green-500` | `#22c55e` | hover accents, glows |
| `--green-600` | `#16a34a` | primary action, nav pip, node glow |
| `--green-700` | `#15803d` | emphasized text, edges |
| `--green-ink` | `#052e16` | body text on glass |

## Glass

| Token | Value | Use |
|---|---|---|
| `--glass-bg` | `rgba(255,255,255,.66)` | standard panels |
| `--glass-bg-strong` | `rgba(255,255,255,.82)` | headers, sidebar |
| `--glass-bg-faint` | `rgba(255,255,255,.42)` | inset wells |
| `--glass-border` | `rgba(34,197,94,.32)` | hairline borders |
| `--glass-border-strong` | `rgba(34,197,94,.55)` | active/interactive borders |
| `--glass-blur` | `blur(20px) saturate(1.4)` | all glass surfaces |
| `--glass-shadow` | `0 10px 34px rgba(5,46,22,.16) + inner highlight` | elevation |
| `--green-glow` | `0 0 0 3px rgba(34,197,94,.22), 0 0 26px rgba(34,197,94,.35)` | focus/selected state |

## Shape & type

- Radii: `--r-lg 18px` (window chrome) · `--r-md 14px` (panels) · `--r-sm 10px` (controls)
- Type: Inter (UI), IBM Plex Sans (alt), IBM Plex Mono (code/IDs/env labels)
- Density: 13px base, 11–12px controls, 9.5–10.5px micro-labels; uppercase letter-spaced section titles

## Surfaces & backdrop

- Page background: layered radial emerald gradients over `#f6fefa→#e7f8ec`
- Grid mesh: 44px rgba(21,128,61,.055) lines, radial-masked
- Shadows are always green-black (`#052e16` at low alpha), never neutral gray

## Interaction

- Focus visible: 2px `--green-600` outline, 2px offset
- Hover: translateY(-1px) + green glow; active module gets left `nav-pip` + gradient wash
- `.pulse` animation for selected graph nodes
