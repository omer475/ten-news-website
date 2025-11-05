# 🚀 Quick Start - Secure Setup

## ⚡ 3-Minute Setup

### Step 1: Create Your `.env` File

**Option A: Interactive Setup (Recommended)**
```bash
./setup_env.sh
```

**Option B: Manual Setup**
```bash
# Copy the template
cp .env.example .env

# Edit the file
nano .env
# Or use your preferred editor:
# code .env
# vim .env
```

Add your API keys:
```bash
CLAUDE_API_KEY=sk-ant-api03-your-key-here
GOOGLE_API_KEY=AIzaSy-your-key-here
PERPLEXITY_API_KEY=pplx-your-key-here
```

---

### Step 2: Verify Setup

```bash
# Test environment variables
python env_loader.py
```

You should see:
```
✅ CLAUDE_API_KEY: sk-ant-a...
✅ GOOGLE_API_KEY: AIzaSy...
✅ PERPLEXITY_API_KEY: pplx-...
✅ All required API keys are set!
```

---

### Step 3: Test Perplexity Client

```bash
python perplexity_client.py
```

You should see:
```
✅ Client created successfully
🔍 Testing search...
✅ Search successful!
```

---

### Step 4: Run Your System

```bash
./RUN_LIVE_SYSTEM_SECURE.sh
```

---

## 🎯 What This Does

### Security Improvements
- ✅ **No hardcoded API keys** - All keys in `.env` file
- ✅ **Git-safe** - `.env` is automatically ignored
- ✅ **Process-safe** - Keys not visible in `ps` output

### Reliability Improvements
- ✅ **Auto-retry** - Automatically retries failed requests
- ✅ **Rate limit protection** - Exponential backoff when rate limited
- ✅ **Circuit breaker** - Stops hammering API when it's down
- ✅ **Graceful fallback** - Uses Claude when Perplexity unavailable

### Monitoring
- ✅ **Success rate tracking** - Know how often calls succeed
- ✅ **Response time** - Track API performance
- ✅ **Error logging** - Detailed error information

---

## 📝 Where Are Your API Keys?

### Get API Keys:
- **Claude**: https://console.anthropic.com/
- **Google (Gemini)**: https://makersuite.google.com/app/apikey
- **Perplexity**: https://www.perplexity.ai/settings/api

### Store API Keys:
- ✅ **Correct**: In `.env` file
- ❌ **Wrong**: In shell scripts
- ❌ **Wrong**: In Python code
- ❌ **Wrong**: Committed to git

---

## 🔒 Security Checklist

Before running:
- [ ] Created `.env` file
- [ ] Added all 3 API keys
- [ ] Verified `.env` is in `.gitignore` (already done)
- [ ] Tested with `python env_loader.py`
- [ ] Never shared `.env` file

---

## 🐛 Quick Troubleshooting

### "PERPLEXITY_API_KEY not found"
```bash
# Check if .env exists
ls -la .env

# If not, create it
./setup_env.sh
```

### "Permission denied" on shell scripts
```bash
# Make scripts executable
chmod +x *.sh
```

### "Import error: perplexity_client"
```bash
# Check if file exists
ls -la perplexity_client.py

# The system will fall back to direct API (still works)
```

---

## 📊 View Statistics

```python
from perplexity_client import get_perplexity_client

client = get_perplexity_client()
stats = client.get_stats()

print(f"Success Rate: {stats['success_rate']:.1%}")
print(f"Avg Response Time: {stats['avg_response_time']:.2f}s")
```

---

## 🎓 What's Different?

### Old Way (Insecure)
```bash
# ❌ BAD - Keys exposed in code
export PERPLEXITY_API_KEY="pplx-abc123..."
python main.py
```

### New Way (Secure)
```bash
# ✅ GOOD - Keys loaded from .env
source load_env.sh
python main.py
```

---

## 📚 More Information

- **Complete Guide**: `SECURITY_GUIDE.md`
- **Implementation Details**: `IMPLEMENTATION_SUMMARY.md`
- **Perplexity Docs**: https://docs.perplexity.ai/docs/best-practices

---

## ✅ You're Done!

Your system now:
- ✅ Protects your API keys
- ✅ Handles errors intelligently
- ✅ Monitors performance
- ✅ Follows best practices

**Run your system:**
```bash
./RUN_LIVE_SYSTEM_SECURE.sh
```

**View logs:**
```bash
tail -f logs/live_system_*.log
```

---

**Need Help?** Check `SECURITY_GUIDE.md` for detailed troubleshooting.

