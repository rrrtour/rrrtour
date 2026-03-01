import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          red: '#DC2626',
          'red-hover': '#B91C1C',
          'red-light': '#FCA5A5',
        },
        surface: {
          900: '#0A0A0B',
          800: '#111113',
          700: '#1A1A1F',
          600: '#252530',
          500: '#32323E',
        },
        text: {
          primary: '#F5F5F7',
          secondary: '#A1A1AA',
          muted: '#6B6B76',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
