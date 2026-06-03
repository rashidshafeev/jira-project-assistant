# Theming & Internationalization

Both the user's **theme** (light/dark) and **language/locale** are available from Jira via
the Forge bridge — we don't have to guess or ask. This documents the approach for each.

## Theming (light/dark, synced with Jira)

### What Jira gives us
- **`view.theme.enable()`** (`@forge/bridge`) fetches the host's current theme and applies
  it in the iframe, **and keeps it in sync reactively** when the user changes their Jira
  theme. It sets a `data-color-mode="light|dark"` attribute on `<html>` and injects
  Atlassian design-token CSS variables.
- `view.getContext()` returns `locale` (we use it for i18n) and `timezone` (not currently
  consumed — see "Future option" below) but **not** the color mode — color mode comes from
  the `data-color-mode` attribute above.

### How we wire it to MUI (we use MUI, not Atlaskit)
1. On bootstrap (Forge only): `await view.theme.enable()`.
2. Read `document.documentElement.dataset.colorMode` → `'light' | 'dark'`.
3. Build the MUI theme with `createTheme({ palette: { mode } })`.
4. Watch for changes with a `MutationObserver` on the `data-color-mode` attribute and
   rebuild the MUI theme → MUI follows Jira live.

### Typography — match Jira's font (no webfont)
Jira's product UI has **no downloadable brand webfont** — the Atlassian Design System renders
text in a **system font stack** (the "Charlie" brand fonts are marketing-only). So matching
Jira's typography costs nothing: we set MUI `typography.fontFamily` to that stack
(`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, …, sans-serif` in
`app/providers/with-theme.tsx`). It resolves to native OS fonts → zero network, and matches
the host. Alternative for pixel-fidelity in Forge: read the host's live `--ds-font-family`
CSS var (injected by `view.theme.enable()`); we don't, because the static stack is what that
token resolves to and it also works in the standalone mock.

### "Clean in Jira UI"
- Setting `palette.mode` correctly gets ~90% of the way (correct dark/light surfaces).
- For a pixel-match we map Atlassian's design-token values into the MUI palette — but as
  **mode-keyed literal hex, not the live `--ds-*` CSS vars.** MUI augments semantic palette
  colors (it computes hover/active shades + contrast text from each base color), so it needs
  *real* color values and **chokes on `var(...)` strings**. So `shared/config/atlassian-tokens.ts`
  holds the resolved hex per mode, and `app/providers/with-theme.tsx` builds the palette from
  `ATLASSIAN_TOKENS[mode]` (e.g. `background.paper: t.raised`). The host still drives it
  **live** — a `MutationObserver` on `data-color-mode` rebuilds the theme when the user
  switches their Jira theme — but the *values* are static, not `var()` references. (See the
  matching gotcha in [`frontend.md`](./frontend.md).)

### Key Atlassian design tokens (reference)

Token → CSS variable, with light / dark values. Always pair a `*-bold` background with
`color.text.inverse` for contrast.

⚠️ **Use the refreshed values, not legacy.** Atlassian ships two token generations; the
*legacy* neutrals (dark surface `#1D2125`, sunken `#2C3338`, text `#C7D1DB`, brand
`#1D7AFC`…) no longer match modern Jira. The values below are the **refreshed** theme,
pulled from `@atlaskit/tokens` v13 `figma/atlassian-{light,dark}-brand-refresh.json` (the authoritative
source — `npm pack @atlaskit/tokens` and read the figma JSON; the live `--ds-*` vars in
Jira resolve to these). Modern dark page surface is `#1F1F21`.

| Token | CSS var | Light | Dark | Use |
|---|---|---|---|---|
| `elevation.surface` | `--ds-surface` | `#FFFFFF` | `#1F1F21` | **page background** (`background.default`) |
| `elevation.surface.raised` | `--ds-surface-raised` | `#FFFFFF` | `#242528` | cards / app bar (`background.paper`) |
| `elevation.surface.sunken` | `--ds-surface-sunken` | `#F8F8F8` | `#18191A` | wells / insets |
| `color.text` | `--ds-text` | `#292A2E` | `#BFC1C4` | primary text |
| `color.text.subtle` | `--ds-text-subtle` | `#505258` | `#A9ABAF` | secondary text |
| `color.border` | `--ds-border` | `#0B120E24` | `#E3E4F21F` | borders / dividers |
| `color.background.brand.bold` | `--ds-background-brand-bold` | `#1868DB` | `#669DF1` | primary action |
| `color.background.danger.bold` | `--ds-background-danger-bold` | `#C9372C` | `#F87168` | error |
| `color.text.warning` | `--ds-text-warning` | `#9E4C00` | `#FBC828` | warning accent † |
| `color.background.success.bold` | `--ds-background-success-bold` | `#5B7F24` | `#94C748` | success |

Note: we map the page to `surface` and cards to `raised` (Atlassian's elevation model).
An earlier bug mapped `background.default` to `sunken`, rendering the page darker than
Jira's actual surface.

† **Warning is a foreground**, never a fill: we paint it on priority icons / the "at risk"
stat / the row accent bar, so we use `color.text.warning` (light `#9E4C00`, AA on white), not
`color.background.warning.bold` (`#FBC828`). That bold amber is a fill *behind* dark text and
is effectively invisible (~1.57:1) used as a glyph on a light surface; dark mode's
`color.text.warning` happens to be `#FBC828`, which is fine on `#1F1F21`.

Source: `@atlaskit/tokens` (`figma/atlassian-{light,dark}-brand-refresh.json`); also
<https://atlassian.design/components/tokens/all-tokens>, <https://atlassian.design/llms-tokens.txt>

### Mock preview (no Forge host)
`view.theme.enable()` would fail outside Forge, so in mock mode we **default to light** and
expose a **manual light/dark toggle** so we can preview both without Jira. The theme
provider therefore has two sources: host-synced (Forge) or local state (mock/toggle).

## Internationalization (follows the user's Jira language)

### Forge has native Custom UI i18n
- The user's **locale is auto-detected** from their Atlassian language setting / browser —
  we don't pass it manually.
- Setup: per-language **translation JSON files** + a `translations` block in `manifest.yml`
  (path + fallback locale). Supported locales are a fixed Atlassian list.
- `@forge/bridge` i18n offers two entry points:
  - `createTranslationFunction` — basic `t(key)` translation.
  - `getTranslations` — integrates with a third-party framework (e.g. **i18next**).

### What we implemented
**react-i18next with bundled resources**, language chosen from `view.getContext().locale`
in Forge (mapped to a supported language, default `en`) and left at the default in the mock
preview (with a manual `EN`/`RU` switch in the dev controls). Bundling the locale JSON keeps
it working identically in mock and Forge. Locales: `en` + `ru` under
`frontend/src/shared/i18n/locales/`.

**Alternative (more "native"):** `@forge/bridge`'s `getTranslations` feeding i18next, with
translation files declared in the manifest `translations` block. More official, but doesn't
work in the standalone mock preview and adds manifest coupling — noted as a future option.

### Cost / scope
i18n adds the discipline of extracting UI strings to keys. A sensible scope is **two
locales** (e.g. `en` + `ru`) to prove the pipeline end-to-end rather than translating
exhaustively.

## Future option: use the context timezone for deadlines
`view.getContext().timezone` exposes the user's Jira timezone. **Not currently used** —
`detectProblems` (`entities/issue/model/problem.ts`) computes "now" from the iframe's local
time (`new Date()`). For strict correctness the "approaching deadline" check *could* compute
"now" in the Jira timezone instead; noted as a future refinement, not implemented.
