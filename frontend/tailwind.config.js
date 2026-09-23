/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'aleman-crema': '#F3EDE0',
        'aleman-verde': '#1F6B3A',
        'aleman-verde-dark': '#164E2A',
        'aleman-rojo': '#C23B3B',
        'aleman-rojo-dark': '#8F2323',
        'aleman-dorado': '#E3A62D',
        'aleman-dorado-light': '#F0BD50',
        'aleman-negro': '#221F1B',
        'aleman-hueso': '#FAF7F0',
      },
      fontFamily: {
        display: ['Oswald', 'sans-serif'],
        body: ['"IBM Plex Sans"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        modalEnter: {
          '0%': { opacity: '0', transform: 'scale(0.97) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        itemEnter: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { transform: 'scale(0)' },
          '70%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(194, 59, 59, 0)' },
          '50%': { boxShadow: '0 0 0 5px rgba(194, 59, 59, 0.35)' },
        },
      },
      animation: {
        modalEnter: 'modalEnter 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        backdropFade: 'fadeIn 0.2s ease-out forwards',
        itemEnter: 'itemEnter 0.22s ease-out forwards',
        popIn: 'popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        pulseGlow: 'pulseGlow 2s infinite',
      },
    },
  },
  plugins: [],
}
