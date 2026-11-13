import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        subtle: 'rgb(var(--subtle) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
        success: 'rgb(var(--success) / <alpha-value>)',
        warning: 'rgb(var(--warning) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        // Pastel card fills. Text on them is always ink, so contrast does not depend on theme.
        pink: 'rgb(var(--pink) / <alpha-value>)',
        yellow: 'rgb(var(--yellow) / <alpha-value>)',
        sage: 'rgb(var(--sage) / <alpha-value>)',
        sky: 'rgb(var(--sky) / <alpha-value>)',
      },
      // Type scale, by role. Use these names, never a raw pixel size (see docs/DESIGN_SYSTEM.md).
      fontSize: {
        micro: ['11px', { lineHeight: '14px' }], // eyebrows, axis labels, badges
        caption: ['12px', { lineHeight: '16px' }], // meta, hints, table headers
        'body-sm': ['13px', { lineHeight: '20px' }], // dense UI: tables, lists, card titles
        body: ['14px', { lineHeight: '22px' }], // default reading text
        lead: ['15px', { lineHeight: '24px' }], // answers, intros
        heading: ['16px', { lineHeight: '22px', letterSpacing: '-0.01em' }], // section headings
        title: ['20px', { lineHeight: '26px', letterSpacing: '-0.015em' }], // panel titles
        stat: ['24px', { lineHeight: '28px', letterSpacing: '-0.02em' }], // KPI values
        display: ['26px', { lineHeight: '32px', letterSpacing: '-0.02em' }], // page titles
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      // Softer geometry everywhere: existing rounded-md / rounded-lg usages pick this up.
      borderRadius: {
        md: '8px',
        lg: '12px',
        xl: '14px',
        '2xl': '16px',
        '3xl': '18px',
      },
    },
  },
  plugins: [],
} satisfies Config;
