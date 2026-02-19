/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Vazirmatn', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent:  'var(--accent)',
        accent2: 'var(--accent2)',
        surface: 'var(--surface)',
        border:  'var(--border)',
        text:    'var(--text)',
        text2:   'var(--text2)',
        text3:   'var(--text3)',
        brand: {
          50:  '#fffbeb',
          100: '#fef3c7',
          400: '#f59e0b',
          500: '#e8c547',
          600: '#d97706',
          700: '#b45309',
        },
      },
    },
  },
  plugins: [],
};
