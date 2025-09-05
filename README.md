# Ten News Website

A modern, responsive news website built with Next.js and React.

## Features

- Smooth scroll-based navigation
- Touch and keyboard controls
- Responsive design
- Newsletter signup
- Progress indicators
- Accessibility features

## Prerequisites

First, you need to install Node.js and npm:

1. **Install Node.js**: Download and install from [nodejs.org](https://nodejs.org/) (LTS version recommended)
2. **Verify installation**: 
```bash
node --version
npm --version
```

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Navigation

- **Scroll**: Mouse wheel or touchpad
- **Touch**: Swipe up/down on mobile
- **Keyboard**: Arrow keys, spacebar
- **Progress dots**: Click to jump to specific stories

## Integration with AI News Generation

This website automatically loads AI-generated news content. The system includes:

### **🤖 News Generator (Python)**
- `news-generator.py` - AI-powered news aggregation and generation
- Fetches global news from GDELT API
- Uses Claude AI to select and rewrite top 10 stories
- Generates daily greetings and historical events
- Runs automatically at 7:00 AM UK time

### **📊 Data Flow**
1. **7:00 AM UK**: Generator creates `tennews_data_YYYY_MM_DD.json`
2. **Website loads**: Automatically detects and loads today's data
3. **Fallback**: Uses sample data if generated data not found

### **🔗 URL Integration**
- All news stories link directly to original sources
- Click any news item to read the full article
- URLs are preserved from original news sources

### **📅 Historical Events**  
- Replaces Wix historical events with local JSON storage
- Shows 4 historical events for today's date
- Rotates in the opening page animation

### **⚙️ Setup Instructions**

1. **Install Dependencies**:
```bash
python setup-news-generator.py
```

2. **Set API Key**:
Edit `news-generator.py` and add your Claude API key:
```python
CLAUDE_API_KEY = "your-claude-api-key-here"
```

3. **Run Generator**:
```bash
# Run once now
python news-generator.py  # Choose option 1

# Start daily scheduler  
python news-generator.py  # Choose option 2
```

4. **Start Website**:
```bash
npm install
npm run dev
```

### **📁 Generated Files**
- `tennews_data_YYYY_MM_DD.json` - Main news data
- `historical_events_YYYY_MM_DD.json` - Historical events
- Files auto-expire after 7 days to save space

## Project Structure

```
├── pages/
│   ├── _app.js          # App wrapper with global CSS
│   └── index.js         # Main news component
├── styles/
│   └── globals.css      # Global styles
├── package.json         # Dependencies
└── next.config.js       # Next.js configuration
```

## Deployment

Build for production:
```bash
npm run build
npm start
```
