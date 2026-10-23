/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          bg: '#0A0D14',
          surface: '#121620',
          elevated: '#171C28',
          border: '#1E2638',
          text: '#F1F5F9',
          muted: '#94A3B8',
          subtle: '#64748B',
        },
        nordic: {
          bg: '#F4F6F9',
          surface: '#FFFFFF',
          elevated: '#F8FAFC',
          border: '#E2E8F0',
          text: '#0F172A',
          muted: '#64748B',
          subtle: '#94A3B8',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          neutral: '#6B7280',
        }
      },
      fontFamily: {
        sans: ['Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
};
