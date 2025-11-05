# ⚠️ WARNING: Old Shell Scripts Contain Exposed API Keys

## 🚨 SECURITY ISSUE

The following shell scripts contain **hardcoded API keys** and should **NOT be used**:

### ❌ Insecure Scripts (DO NOT USE)
- `RUN_LIVE_SYSTEM.sh`
- `START_FIXED_SYSTEM.sh`
- `RESTART_NOW.sh`
- `START_NEW_SCORING.sh`
- `RESTART_FIXED_SYSTEM.sh`
- `TEST_FULL_SYSTEM.sh`
- `RUN_AND_PUBLISH.sh`
- `RUN_COMPLETE_SYSTEM.sh`
- `PUSH_TO_WEBSITE.sh`
- `START_FULL_SYSTEM.sh`

**Problem:** These scripts expose your API keys:
```bash
# ❌ INSECURE - Keys visible in:
# - Shell history
# - Process list (ps aux)
# - Git history (if committed)
export PERPLEXITY_API_KEY="pplx-YOUR_KEY_HERE"
```

---

## ✅ USE THESE INSTEAD

### Secure Alternatives

| Old Script | New Secure Alternative |
|------------|------------------------|
| `RUN_LIVE_SYSTEM.sh` | `RUN_LIVE_SYSTEM_SECURE.sh` |
| Any other `.sh` script | Update to use `source load_env.sh` |

---

## 🔧 How to Fix Old Scripts

If you need to use an old script, update it:

**Before:**
```bash
#!/bin/bash
export CLAUDE_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AIza..."
export PERPLEXITY_API_KEY="pplx-..."
python main.py
```

**After:**
```bash
#!/bin/bash
# Load environment variables securely
source load_env.sh
python main.py
```

---

## 🗑️ Recommended Action

### Option 1: Delete Old Scripts
```bash
# Back them up first
mkdir old_scripts_backup
mv RUN_LIVE_SYSTEM.sh old_scripts_backup/
# ... move other old scripts
```

### Option 2: Update Them
Add to the top of each script:
```bash
# Load environment variables from .env
source load_env.sh
# Remove all export PERPLEXITY_API_KEY= lines
```

---

## 🔒 Security Checklist

If these scripts were committed to git:

1. **Check git history:**
   ```bash
   git log --all --full-history -- "*.sh"
   ```

2. **Consider rotating your API keys:**
   - New Perplexity key: https://www.perplexity.ai/settings/api
   - New Claude key: https://console.anthropic.com/
   - New Google key: https://makersuite.google.com/app/apikey

3. **Update your `.env` file with new keys**

4. **Optionally remove from git history** (advanced):
   ```bash
   # WARNING: This rewrites git history!
   # Backup first!
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch RUN_LIVE_SYSTEM.sh" \
     --prune-empty --tag-name-filter cat -- --all
   ```

---

## 📋 Current Status

### Your API Keys Are Exposed In:
- ❌ Multiple `.sh` files in the repository
- ❌ Possibly in git history (if committed)
- ❌ Possibly in shell history (`~/.bash_history`, `~/.zsh_history`)

### Your API Keys Are Safe In:
- ✅ `.env` file (not committed, in .gitignore)
- ✅ `perplexity_client.py` (uses environment variables)
- ✅ `ai_filter.py` (uses environment variables)

---

## 🎯 Next Steps

1. **Immediate:**
   ```bash
   # Setup secure environment
   ./setup_env.sh
   
   # Use secure script
   ./RUN_LIVE_SYSTEM_SECURE.sh
   ```

2. **Soon:**
   - Review old scripts
   - Delete or update them
   - Consider rotating API keys

3. **Eventually:**
   - Clean git history (if keys were committed)
   - Audit all files for hardcoded secrets

---

## 📞 Questions?

See:
- `QUICK_START_SECURE.md` - Quick setup guide
- `SECURITY_GUIDE.md` - Complete security documentation
- `IMPLEMENTATION_SUMMARY.md` - What was implemented

---

**Created:** October 11, 2025  
**Purpose:** Warn about insecure scripts and guide to secure alternatives

