/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#F4F6F8',
    tint: '#4C8DFF',

    // Core surfaces
    background: '#090B0D',
    foreground: '#F4F6F8',

    // Cards / elevated surfaces
    card: '#12161B',
    cardForeground: '#F4F6F8',

    // Primary action color (buttons, links, active states)
    primary: '#4C8DFF',
    primaryForeground: '#F4F6F8',
    positive: '#37D67A',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#1C2229',
    secondaryForeground: '#F4F6F8',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#17202A',
    mutedForeground: '#F4F6F8',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#1A315A',
    accentForeground: '#4C8DFF',

    // Destructive actions (delete, error states)
    destructive: '#4C8DFF',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#F4F6F81A',
    input: '#F4F6F81A',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
