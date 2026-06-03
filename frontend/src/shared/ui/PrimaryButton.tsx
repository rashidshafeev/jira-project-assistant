import Button, { type ButtonProps } from '@mui/material/Button'

/**
 * The app's primary action button — styled to match Jira's native "Create" button
 * in the product top bar: a solid brand-blue fill, flat, sentence case.
 *
 * The fill is the brand-keyed `palette.primary` (`color.background.brand.bold`),
 * so it inverts the way the real product button does — dark blue with white text
 * in light mode, bright blue with dark text in dark mode (MUI derives the
 * contrast text). `disableElevation` drops Material's drop shadow so it reads flat
 * like Atlassian's button, which darkens on hover/press instead of lifting.
 * Sentence case, the 3px radius and the medium weight already come from the theme.
 *
 * Used for the row "Fix" action and the bulk "Assign all" (incl. its confirm).
 * Forwards every `Button` prop, so callers can still set `size`, `disabled`, etc.
 */
export function PrimaryButton(props: ButtonProps) {
  return <Button variant="contained" color="primary" disableElevation {...props} />
}
