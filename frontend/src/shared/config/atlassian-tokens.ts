/**
 * Atlassian Design System token values (light/dark), used to align the MUI
 * palette with Jira so the app looks native in the product.
 *
 * WHY THIS LIVES IN `shared/config` (not `app`). FSD places code by what it *is*,
 * and imports only ever point downward (app → … → shared). This is static,
 * business-agnostic data with zero dependencies — textbook `shared` material, so
 * it sits on the floor where any layer may read it. It happens to have a single
 * consumer today (`app/providers/with-theme.tsx`), but that's incidental: promote
 * it to `app` and any future `shared/ui` or `entities` code that wanted a raw
 * token would have to import *upward*, which FSD forbids. Bottom layer = legal
 * for everyone.
 *
 * WHY HEX, NOT CSS (`var(--ds-*)` or our own custom properties). These values
 * feed `createTheme({ palette })`, and MUI *computes* shades + contrast text for
 * the semantic colors (primary/error/…) — it needs real color values and chokes
 * on `var(...)` strings. So the palette source must be literal hex. That also
 * rules out hand-written CSS variables: MUI's own `cssVariables` mode *generates*
 * vars *from* this JS theme, it doesn't consume hand-authored ones — a CSS layer
 * would be a second source of truth to keep in sync, minus the `AtlassianTokenSet`
 * type (and minus the Forge inline-style CSP friction). Since our mode is already
 * synced to the host theme (see forge-bootstrap), mode-keyed hex matches Jira in
 * both Forge and the mock preview, where the live `--ds-*` vars don't even exist.
 *
 * Values are the **refreshed** Atlassian theme (the "brand-refresh" token
 * generation, read from `@atlaskit/tokens`' `figma/atlassian-{light,dark}-
 * brand-refresh.json` — the authoritative source the live `--ds-*` vars resolve
 * to), NOT the legacy generation. The legacy neutrals (e.g. dark surface
 * `#1D2125`) no longer match modern Jira, whose dark page surface is `#1F1F21`.
 *
 *   elevation.surface         → page background  (background.default)
 *   elevation.surface.raised  → cards/app bar    (background.paper)
 *   elevation.surface.sunken  → wells/insets
 *   color.text / .subtle      → text primary / secondary
 *   color.border              → divider
 *   color.background.neutral.subtle.hovered → table row hover (rowHover)
 *   color.background.{brand,danger,warning,success}.bold → semantic accents
 *   color.background.accent.{gray,blue,green}.subtler + color.text.accent.*.bolder
 *                             → status lozenges (LOZENGE_TOKENS)
 *   color.icon.accent.{red,orange,blue} → priority severity icons (PRIORITY_COLORS)
 */

// Type-only import (erased at runtime) so this config stays dependency-free — it
// must not pull in the api barrel's transport side-effects.
import type { IssuePriority } from '@/shared/api/issue'

type Mode = 'light' | 'dark'

export interface AtlassianTokenSet {
  /** elevation.surface — the page background Jira renders behind our content. */
  surface: string
  /** elevation.surface.raised — elevated cards/app bar. */
  raised: string
  /** elevation.surface.sunken — wells/insets. */
  sunken: string
  text: string
  subtle: string
  border: string
  /** color.background.neutral.subtle.hovered — table/list row hover. */
  rowHover: string
  brand: string
  danger: string
  /**
   * color.text.warning — the warning FOREGROUND (icon glyph, accent bar, "at risk"
   * stat number). We only ever paint warning as a foreground on a surface, never as
   * a fill, so this is the *text* token (light `#9E4C00`, AA on white), NOT
   * `background.warning.bold` (`#FBC828`) — that bold amber is a fill behind dark
   * text and is effectively invisible (1.57:1) used as a glyph/bar on a light surface.
   * Dark mode's `color.text.warning` happens to be `#FBC828`, which is fine on `#1F1F21`.
   */
  warning: string
  success: string
}

export const ATLASSIAN_TOKENS: Record<Mode, AtlassianTokenSet> = {
  light: {
    surface: '#FFFFFF',
    raised: '#FFFFFF',
    sunken: '#F8F8F8',
    text: '#292A2E',
    subtle: '#505258',
    border: '#0B120E24',
    rowHover: '#0515240F',
    brand: '#1868DB',
    danger: '#C9372C',
    warning: '#9E4C00', // color.text.warning (light) — AA foreground on white
    success: '#5B7F24',
  },
  dark: {
    surface: '#1F1F21',
    raised: '#242528',
    sunken: '#18191A',
    text: '#BFC1C4', // color.text (dark) — was #CECFD2 (that is color.icon/neutral.bold)
    subtle: '#A9ABAF',
    border: '#E3E4F21F',
    rowHover: '#CECED912',
    brand: '#669DF1',
    danger: '#F87168',
    warning: '#FBC828', // color.text.warning (dark) — AA foreground on #1F1F21
    success: '#94C748',
  },
}

/**
 * Status-lozenge colors, mirroring @atlaskit/lozenge appearances by status
 * category: `new`→todo (grey), `indeterminate`→inProgress (blue), `done`→green.
 * Values are the Atlassian accent "subtler background + bolder text" set
 * (`color.background.accent.{gray,blue,green}.subtler` + `color.text.accent.*.bolder`,
 * @atlaskit/tokens brand-refresh), all WCAG-AA for the lozenge's small bold text. We use the
 * solid accent gray for `todo` rather than the semantic neutral overlay (an 8-digit
 * alpha) because MUI/solid hex composite predictably on either surface.
 */
export interface LozengeColors {
  bg: string
  text: string
}
type LozengeKey = 'todo' | 'inProgress' | 'done'

export const LOZENGE_TOKENS: Record<Mode, Record<LozengeKey, LozengeColors>> = {
  light: {
    todo: { bg: '#DDDEE1', text: '#1E1F21' },
    inProgress: { bg: '#CFE1FD', text: '#123263' },
    done: { bg: '#BAF3DB', text: '#164B35' },
  },
  dark: {
    todo: { bg: '#4B4D51', text: '#E2E3E4' },
    inProgress: { bg: '#123263', text: '#CFE1FD' },
    done: { bg: '#164B35', text: '#BAF3DB' },
  },
}

/**
 * Priority severity-icon colors, mapped to Atlassian `color.icon.accent.*` tokens
 * (@atlaskit/tokens brand-refresh) — theme-aware, unlike Jira's legacy static-hex SVGs.
 * Highest/High share red and Low/Lowest share blue *by design* (Jira disambiguates
 * them by icon shape — double vs single chevron — which we mirror), keeping the set
 * accessible for color-blind users.
 */
export const PRIORITY_COLORS: Record<Mode, Record<IssuePriority, string>> = {
  light: {
    Highest: '#C9372C',
    High: '#C9372C',
    Medium: '#E06C00',
    Low: '#357DE8',
    Lowest: '#357DE8',
  },
  dark: {
    Highest: '#E2483D',
    High: '#E2483D',
    Medium: '#F68909',
    Low: '#4688EC',
    Lowest: '#4688EC',
  },
}
