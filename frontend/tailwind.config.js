/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ledger: {
          red: '#B91C1C',
          redDark: '#991B1B',
          paper: '#FFFFFF',
          paperDark: '#F3F4F6',
          ink: '#111827',
          inkSoft: '#6B7280',
          brass: '#D97706',
          sage: '#059669',
          rust: '#EA580C',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'ledger-lines':
          'repeating-linear-gradient(to bottom, transparent, transparent 35px, rgba(139,46,46,0.08) 36px)',
      },
    },
  },
  plugins: [],
};
