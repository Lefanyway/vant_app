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
    text: '#0a0a0a',
    tint: '#2f95dc',

    // Core surfaces
    background: '#090B0D',
    foreground: '#F2F5F7',

    // Cards / elevated surfaces
    card: '#121619',
    cardForeground: '#F2F5F7',

    // Primary action color (buttons, links, active states)
    primary: '#B7F34B',
    primaryForeground: '#0A0D0E',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#1B2224',
    secondaryForeground: '#DCE3E6',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#172022',
    mutedForeground: '#89969C',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#253217',
    accentForeground: '#B7F34B',

    // Destructive actions (delete, error states)
    destructive: '#F0445E',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#243034',
    input: '#243034',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
