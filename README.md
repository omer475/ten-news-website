# 🗞️ Ten News Website

A modern, AI-powered news website with automated content generation and beautiful UI.

## 🌟 Features

- **AI-Curated News**: Daily automated news generation using GDELT API + Claude AI
- **Smooth Navigation**: Scroll-based, touch, and keyboard controls
- **Responsive Design**: Mobile-first approach with beautiful animations
- **Real-time Content**: Fresh news every day at 7 AM UTC
- **Performance Optimized**: Built for Vercel deployment with edge caching

## 🚀 Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/omer475/ten-news-website)

### Manual Deployment Steps:

1. **Connect to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "New Project"
   - Import `omer475/ten-news-website`

2. **Configure Environment Variables**:
   - In Vercel dashboard: Settings → Environment Variables
   - Add: `CLAUDE_API_KEY` = your Claude API key
   - Add: `NODE_ENV` = production

3. **Deploy**: Vercel will automatically build and deploy!

## 🛠️ Local Development

### Prerequisites
- Node.js 18.17.0+ ([download here](https://nodejs.org/))
- npm or yarn package manager

### Setup
```bash
# Clone the repository
git clone https://github.com/omer475/ten-news-website.git
cd ten-news-website

# Install dependencies
npm install

# Run development server
npm run dev

# Open http://localhost:3000
```

## 🤖 Automated News Generation

### How It Works:
1. **Daily at 7 AM UTC**: GitHub Actions runs `news-generator.py`
2. **Fetches Global News**: From GDELT Project API
3. **AI Curation**: Claude AI selects and rewrites top 10 stories
4. **Auto-Deploy**: Fresh content pushed to repository
5. **Website Updates**: Vercel automatically rebuilds with new content

### Manual News Generation:
```bash
# Install Python dependencies
pip install requests beautifulsoup4 pytz schedule

# Set your Claude API key in news-generator.py
CLAUDE_API_KEY = "your-api-key-here"

# Run generator
python news-generator.py
```

## 📁 Project Structure

```
ten-news-website/
├── .github/workflows/       # GitHub Actions automation
│   └── news-generation.yml  # Daily news generation
├── pages/                   # Next.js pages
│   ├── api/news.js         # News data API endpoint
│   ├── _app.js             # App configuration
│   └── index.js            # Main news page
├── styles/
│   └── globals.css         # Global styles
├── news-generator.py       # AI news generator
├── vercel.json            # Vercel deployment config
├── next.config.js         # Next.js configuration
└── package.json           # Dependencies
```

## ⚙️ Configuration

### Vercel Settings
- **Framework**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Node.js Version**: 18.x

### Environment Variables
- `CLAUDE_API_KEY`: Your Anthropic Claude API key
- `NODE_ENV`: production/development

## 🌐 API Endpoints

- `GET /api/news` - Returns today's news data with caching headers
- Static files: `tennews_data_YYYY_MM_DD.json` - Generated news files

## 🔧 Performance Features

- **Edge Caching**: 5-minute cache for news data
- **Image Optimization**: WebP/AVIF format support  
- **Security Headers**: XSS protection, frame options, content sniffing
- **Compression**: Gzip/Brotli compression enabled
- **Static Assets**: Long-term caching for CSS/JS/images

## 📱 Navigation

- **Scroll**: Mouse wheel or touchpad
- **Touch**: Swipe up/down on mobile devices
- **Keyboard**: Arrow keys, spacebar for navigation
- **Progress Dots**: Click to jump to specific stories

## 🔒 Security

- Content Security Policy headers
- XSS protection enabled
- No sensitive data in client-side code
- API keys stored as environment variables

## 📊 Monitoring

The website includes:
- Performance monitoring via Vercel Analytics
- Error tracking and logging
- Automated uptime monitoring through GitHub Actions

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is private. All rights reserved.

---

**Built with ❤️ using Next.js, Claude AI, and Vercel**
