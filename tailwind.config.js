/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#1e1f22',
          sidebar: '#2c2b31',
          hover: '#35373c',
          input: '#383a40',
          text: '#dbdee1',
          muted: '#949ba4',
        },
        brand: {
          primary: '#ef9f64',
          hover: '#d98850',
        },
        admin: '#f23f42',
        moderator: '#faa81a',
        member: '#80848e',
      },
      spacing: {
        'safe-top': 'var(--safe-area-inset-top)',
        'safe-bottom': 'var(--safe-area-inset-bottom)',
      }
    },
  },
  plugins: [],
}
