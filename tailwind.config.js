/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}', './shared/**/*.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#ffc9aa',
          300: '#ffa274',
          400: '#ff6f3c',
          500: '#fe4a16',
          600: '#ef300c',
          700: '#c6200c',
          800: '#9d1c12',
          900: '#7e1b12',
        },
        ink: {
          50: '#f5f5fb',
          100: '#ebeaf6',
          200: '#d4d2ec',
          300: '#aeaad9',
          400: '#8279c1',
          500: '#6157a9',
          600: '#4d438e',
          700: '#3f3774',
          800: '#2b2655',
          900: '#1b1838',
          950: '#110f26',
        },
      },
      boxShadow: {
        soft: '0 2px 8px -2px rgba(27,24,56,.06), 0 8px 24px -6px rgba(27,24,56,.10)',
        lift: '0 12px 40px -12px rgba(27,24,56,.25)',
        glow: '0 10px 30px -8px rgba(254,74,22,.45)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #ff6f3c 0%, #fe4a16 45%, #e11d74 100%)',
        'ink-gradient': 'linear-gradient(135deg, #1b1838 0%, #3f3774 100%)',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pop: { '0%': { transform: 'scale(.9)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } },
      },
      animation: {
        'fade-up': 'fade-up .4s ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 5s ease-in-out infinite',
        pop: 'pop .25s ease-out both',
      },
    },
  },
  plugins: [],
};
