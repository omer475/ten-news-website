# TEN NEWS - Security & Best Practices Guide

## 🔐 API Key Security

### ✅ WHAT WE IMPLEMENTED (Perplexity Best Practices)

Based on [Perplexity's Security Documentation](https://docs.perplexity.ai/docs/best-practices), we've implemented:

#### 1. **Secure Environment Variable Management**
- ✅ API keys stored in `.env` file (never in source code)
- ✅ `.env` file is in `.gitignore` (never committed to git)
- ✅ Environment variable validation at startup
- ✅ Secure loading with `load_env.sh`

#### 2. **Enhanced Perplexity Client** (`perplexity_client.py`)
- ✅ **Exponential Backoff with Jitter**: Intelligent retry logic for rate limits
- ✅ **Circuit Breaker Pattern**: Automatically stops requests when failure threshold is reached
- ✅ **Request Monitoring**: Tracks success rate, response times, error counts
- ✅ **Graceful Degradation**: Falls back to Claude when Perplexity is unavailable
- ✅ **Configurable Timeouts**: Prevents hanging requests
- ✅ **Connection Pooling**: Efficient reuse of connections

#### 3. **Rate Limiting & Error Handling**
- ✅ Automatic retry with exponential backoff (max 3 retries by default)
- ✅ Circuit breaker activates after 5 consecutive failures
- ✅ Comprehensive error handling for all API call types
- ✅ Timeout handling with configurable limits

#### 4. **Monitoring & Logging**
- ✅ Request/response timing tracking
- ✅ Success/error rate monitoring
- ✅ Detailed error logging
- ✅ Circuit breaker status tracking

---

## 🚀 Quick Start

### 1. Setup Environment Variables

```bash
# Run the interactive setup script
./setup_env.sh
```

Or manually create `.env`:

```bash
# Copy the example
cp .env.example .env

# Edit with your actual keys
nano .env
```

**`.env` file format:**
```bash
# Required API Keys
CLAUDE_API_KEY=sk-ant-api03-...
GOOGLE_API_KEY=AIzaSy...
PERPLEXITY_API_KEY=pplx-...

# Perplexity Configuration (optional)
PERPLEXITY_MAX_RETRIES=3
PERPLEXITY_TIMEOUT=60
PERPLEXITY_MAX_CONNECTIONS=100
PERPLEXITY_MAX_KEEPALIVE=20

# Environment
ENVIRONMENT=development
```

### 2. Validate Setup

```bash
# Test environment variables
python env_loader.py

# Test Perplexity client
python perplexity_client.py
```

### 3. Run System Securely

```bash
# Use the secure launch script
./RUN_LIVE_SYSTEM_SECURE.sh
```

---

## 📋 Usage Examples

### Basic Usage (Automatic)

The enhanced Perplexity client is automatically used in `ai_filter.py`:

```python
# Automatically uses enhanced client with rate limiting
ai_filter = AINewsFilter()
ai_filter.run_forever()
```

### Advanced Usage (Manual)

```python
from perplexity_client import get_perplexity_client

# Get singleton client instance
client = get_perplexity_client()

# Make a search with automatic retry and error handling
result = client.search(
    query="What are the latest AI developments?",
    model="llama-3.1-sonar-large-128k-online",
    temperature=0.2,
    max_tokens=1000
)

# Check statistics
stats = client.get_stats()
print(f"Success rate: {stats['success_rate']:.1%}")
print(f"Avg response time: {stats['avg_response_time']:.2f}s")
```

### Convenience Function

```python
from perplexity_client import search_with_perplexity

# Quick search without managing client
result = search_with_perplexity("AI news", max_tokens=500)
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PERPLEXITY_API_KEY` | ✅ Yes | - | Your Perplexity API key |
| `PERPLEXITY_MAX_RETRIES` | No | 3 | Max retry attempts for failed requests |
| `PERPLEXITY_TIMEOUT` | No | 60 | Request timeout in seconds |
| `PERPLEXITY_MAX_CONNECTIONS` | No | 100 | Max concurrent connections |
| `PERPLEXITY_MAX_KEEPALIVE` | No | 20 | Max keepalive connections |
| `ENVIRONMENT` | No | production | Environment name (dev/prod) |

### Circuit Breaker Settings

In `perplexity_client.py`:
```python
self.circuit_breaker_threshold = 5  # Failures before opening circuit
self.circuit_breaker_reset_time = 60  # Seconds before reset attempt
```

---

## 🛡️ Security Best Practices

### ✅ DO:
- ✅ **Use `.env` file** for API keys
- ✅ **Never commit `.env`** to version control
- ✅ **Rotate API keys regularly** (every 90 days)
- ✅ **Use environment-specific keys** (dev/staging/prod)
- ✅ **Monitor API usage** and set up alerts
- ✅ **Validate environment variables** at startup
- ✅ **Use the enhanced client** for automatic error handling

### ❌ DON'T:
- ❌ **Never hardcode API keys** in source code
- ❌ **Never commit API keys** to git
- ❌ **Never share API keys** publicly
- ❌ **Never log API keys** (even partially)
- ❌ **Don't use same keys** across environments
- ❌ **Don't skip error handling**

---

## 🐛 Troubleshooting

### "PERPLEXITY_API_KEY not found"

```bash
# Check if .env exists
ls -la .env

# If not, create it:
./setup_env.sh

# Or load it manually:
source load_env.sh
```

### "Circuit breaker activated"

The system is protecting you from rate limits. Wait 60 seconds or:

```python
client = get_perplexity_client()
client.circuit_breaker_open = False  # Manual reset (not recommended)
```

### "Rate limit exceeded"

The enhanced client handles this automatically with exponential backoff. If you see this repeatedly:
1. Check your API usage at https://www.perplexity.ai/settings/api
2. Increase `PERPLEXITY_MAX_RETRIES`
3. Add delays between batches in your code

### Testing Without Perplexity

The system gracefully falls back to Claude:

```python
# Perplexity unavailable → Claude used automatically
# Timeline generation: Perplexity → Claude fallback
# Details generation: Perplexity → Claude fallback
```

---

## 📊 Monitoring

### View Client Statistics

```python
from perplexity_client import get_perplexity_client

client = get_perplexity_client()
stats = client.get_stats()

print(f"""
Perplexity API Stats:
  Total Requests: {stats['total_requests']}
  Success Rate: {stats['success_rate']:.1%}
  Error Count: {stats['error_count']}
  Avg Response Time: {stats['avg_response_time']:.2f}s
  Circuit Breaker: {'🔴 OPEN' if stats['circuit_breaker_open'] else '🟢 CLOSED'}
""")
```

### Log Files

```bash
# AI Filter logs
tail -f ai_filter.log

# Live system logs
tail -f logs/live_system_*.log
```

---

## 🔄 Migration from Old Scripts

### Old Scripts (Insecure - DO NOT USE)
- ❌ `RUN_LIVE_SYSTEM.sh` - Hardcoded API keys
- ❌ `START_FULL_SYSTEM.sh` - Hardcoded API keys
- ❌ All other `.sh` files with `export PERPLEXITY_API_KEY=...`

### New Scripts (Secure - USE THESE)
- ✅ `setup_env.sh` - Create `.env` file
- ✅ `load_env.sh` - Load environment variables
- ✅ `RUN_LIVE_SYSTEM_SECURE.sh` - Secure launcher
- ✅ `env_loader.py` - Python environment loader
- ✅ `perplexity_client.py` - Enhanced client

### Migration Steps:

1. **Remove old API keys from git history** (if committed):
   ```bash
   # WARNING: This rewrites git history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch *.sh" \
     --prune-empty --tag-name-filter cat -- --all
   ```

2. **Setup new system**:
   ```bash
   ./setup_env.sh
   ```

3. **Update all shell scripts** to use `load_env.sh`:
   ```bash
   # Add to the top of your scripts:
   source load_env.sh
   ```

4. **Test**:
   ```bash
   python env_loader.py
   python perplexity_client.py
   ```

---

## 📚 Additional Resources

- [Perplexity API Documentation](https://docs.perplexity.ai/)
- [Perplexity Best Practices](https://docs.perplexity.ai/docs/best-practices)
- [Get API Key](https://www.perplexity.ai/settings/api)

---

## 🆘 Support

If you encounter issues:

1. Check this guide
2. Run diagnostics: `python env_loader.py`
3. Check logs: `tail -f ai_filter.log`
4. Review circuit breaker status in logs

---

**Last Updated:** October 11, 2025  
**Version:** 2.0 (Secure with Enhanced Client)

