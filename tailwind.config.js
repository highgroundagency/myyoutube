/** @type {import('tailwindcss').Config} */

// Accent: muted coral red. Familiar without being a literal YouTube red.
// IMPORTANT: keep the 500 value in sync with ACCENT_HEX in src/config/constants.ts
// (the SVG logo reads the hex from there; this file feeds the Tailwind classes).
const accent = {
  50: '#fef2f2',
  100: '#fde3e4',
  200: '#fbcccd',
  300: '#f6a6a9',
  400: '#ef7479',
  500: '#f2555a',
  600: '#dc3a40',
  700: '#b92c31',
  800: '#99272b',
  900: '#7f2629',
  950: '#450f10',
  DEFAULT: '#f2555a',
};

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent,
        // Semantic tokens driven by CSS variables (see src/index.css).
        // Lets us theme light and dark from one set of class names.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-muted': 'rgb(var(--fg-muted) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
