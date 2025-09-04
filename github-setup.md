# 🚀 GitHub Setup Guide for Ten News

## Step 1: Create GitHub Repository

1. **Go to GitHub.com** and sign in
2. **Click "New repository"** (+ icon, top right)
3. **Repository name**: `ten-news-website`
4. **Description**: `AI-powered news website with daily content generation`
5. **Set to Public** (or Private if you prefer)
6. **Don't initialize** with README (we already have files)
7. **Click "Create repository"**

## Step 2: Connect Your Local Project

Run these commands in your project folder:

```bash
# Initialize git (if not already done)
git init

# Add all files to git
git add .

# Make first commit
git commit -m "Initial commit: Ten News website with AI integration"

# Connect to your GitHub repository (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/ten-news-website.git

# Push to GitHub
git push -u origin main
```

## Step 3: Set Up GitHub Actions (Optional)

Create automated deployment with GitHub Actions:

### Option A: Simple Auto-Deployment
```yaml
# .github/workflows/deploy.yml
name: Deploy Ten News
on:
  push:
    branches: [ main ]
  schedule:
    - cron: '0 7 * * *'  # Run at 7 AM UTC daily

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Build
        run: npm run build
```

### Option B: Include News Generation
```yaml
# .github/workflows/news-generation.yml  
name: Generate Daily News
on:
  schedule:
    - cron: '0 7 * * *'  # 7 AM UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.9'
      - name: Install Python dependencies
        run: |
          pip install requests beautifulsoup4 pytz schedule
      - name: Generate news
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
        run: python news-generator.py
      - name: Commit news data
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add *.json
          git commit -m "Daily news update $(date)" || exit 0
          git push
```

## Step 4: Environment Variables

For production, set your API key as environment variable:

1. **Go to your GitHub repo** → Settings → Secrets and variables → Actions
2. **Click "New repository secret"**
3. **Name**: `CLAUDE_API_KEY`
4. **Value**: Your actual Claude API key
5. **Click "Add secret"**

## Step 5: Deploy to Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow prompts)
vercel

# For production deployment
vercel --prod
```

## Step 6: Update Local Code for Production

Update `news-generator.py` to use environment variables:

```python
import os
CLAUDE_API_KEY = os.environ.get('CLAUDE_API_KEY', 'your-fallback-key-here')
```

## Quick Commands Reference

```bash
# Daily workflow:
git add .
git commit -m "Update: description of changes"
git push

# Check status
git status

# View commit history  
git log --oneline

# Create new branch for features
git checkout -b feature-name
git push -u origin feature-name
```

## Repository Structure

```
ten-news-website/
├── .github/workflows/     # GitHub Actions (optional)
├── pages/                 # Next.js pages
├── styles/               # CSS files
├── news-generator.py     # AI news generator
├── setup-news-generator.py  # Setup script
├── test-integration.py   # Testing script  
├── package.json         # Node.js dependencies
├── README.md           # Project documentation
├── .gitignore         # Git ignore rules
└── tennews_data_*.json # Generated news data
```

## 🔒 Security Notes

- ✅ API keys are in `.gitignore` 
- ✅ Use environment variables for production
- ✅ Never commit API keys to GitHub
- ✅ Generated data files are gitignored (optional)

## 🚀 Benefits of GitHub

1. **Version Control** - Track all changes
2. **Backup** - Code safely stored online  
3. **Collaboration** - Others can contribute
4. **Deployment** - Auto-deploy to Vercel/Netlify
5. **Actions** - Automated news generation
6. **Issues** - Track bugs and features
