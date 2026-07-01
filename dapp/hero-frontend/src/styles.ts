// The three visual motifs that recur across components, so a theme change is
// one edit. Components spread these and add their own layout locally.

/** Red alert/error banner (deployment warning, tx errors). */
export const alertBanner = {
  padding: 12,
  background: '#fef2f2',
  color: '#991b1b',
  borderRadius: 8,
  fontSize: '0.85rem',
} as const;

/** Indigo primary action button (mint, equip). */
export const primaryButton = {
  background: '#4f46e5',
  color: '#fff',
  border: 'none',
  fontWeight: 700,
} as const;

/** Dark "code" panel (resolved Display output, lesson snippets). */
export const codePanel = {
  background: '#0d1117',
  color: '#e6edf3',
  fontFamily: 'ui-monospace, monospace',
} as const;
