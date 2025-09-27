/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        category: {
          'world-news': '#dc2626',
          'business': '#f97316',
          'markets': '#06b6d4',
          'tech-ai': '#8b5cf6',
          'science': '#0ea5e9',
          'health': '#10b981',
          'climate': '#22c55e',
          'sports': '#f59e0b',
          'entertainment': '#ec4899',
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        'xs': ['11px', { lineHeight: '16px' }],
        'sm': ['12px', { lineHeight: '18px' }],
        'base': ['16px', { lineHeight: '24px' }],
        'lg': ['18px', { lineHeight: '28px' }],
        'xl': ['20px', { lineHeight: '30px' }],
        '2xl': ['24px', { lineHeight: '32px' }],
        '3xl': ['30px', { lineHeight: '36px' }],
        '4xl': ['36px', { lineHeight: '40px' }],
        '5xl': ['48px', { lineHeight: '52px' }],
        '6xl': ['60px', { lineHeight: '64px' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      animation: {
        'gentle-bounce': 'gentleBounce 3s ease-in-out infinite',
        'topic-rotate': 'topicRotate 15s infinite',
        'timeline-slide': 'timelineSlideIn 0.5s ease forwards',
      },
      keyframes: {
        gentleBounce: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        topicRotate: {
          '0%, 20%, 100%': { 
            opacity: '0',
            transform: 'translateY(5px)',
          },
          '2%, 18%': { 
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        timelineSlideIn: {
          from: {
            opacity: '0',
            transform: 'translateX(-10px)',
          },
          to: {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
