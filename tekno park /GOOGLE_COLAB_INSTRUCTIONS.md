# 🚀 GOOGLE COLAB INSTRUCTIONS - STEP BY STEP

## 📋 **WHAT TO COPY AND PASTE**

Copy **THE ENTIRE CONTENT** of the file: `google_colab_setup.py`

## 🔑 **WHERE TO PASTE YOUR API KEY**

After copying the code into Google Colab, find this section around **LINE 344**:

```python
# 🔑🔑🔑 PASTE YOUR CLAUDE API KEY HERE 🔑🔑🔑
# ⬇️⬇️⬇️ REPLACE "YOUR_CLAUDE_API_KEY" WITH YOUR ACTUAL API KEY ⬇️⬇️⬇️
CLAUDE_API_KEY = "YOUR_CLAUDE_API_KEY"  # ← REPLACE THIS WITH YOUR REAL API KEY
# ⬆️⬆️⬆️ REPLACE "YOUR_CLAUDE_API_KEY" WITH YOUR ACTUAL API KEY ⬆️⬆️⬆️
```

**CHANGE IT TO:**
```python
CLAUDE_API_KEY = "sk-ant-api03-your-actual-key-here"  # Your real API key
```

## 📝 **COMPLETE STEP-BY-STEP PROCESS**

### **Step 1: Open Google Colab**
- Go to https://colab.research.google.com/
- Create a new notebook

### **Step 2: Copy the Code**
- Open the file `google_colab_setup.py` 
- **Copy ALL 408 lines** (the entire file)
- Paste it into a new cell in Google Colab

### **Step 3: Add Your API Key**
- Scroll down to around **line 344** in the pasted code
- Look for the line with `CLAUDE_API_KEY = "YOUR_CLAUDE_API_KEY"`
- Replace `"YOUR_CLAUDE_API_KEY"` with your actual Claude API key in quotes

### **Step 4: Run the Code**
- Click the play button to run the cell
- Wait for dependencies to install (takes ~1 minute)

### **Step 5: Start Scraping**

**For testing (5 companies only):**
```python
run_scraper(CLAUDE_API_KEY, test_mode=True)
```

**For full scraping (all companies):**
```python
run_scraper(CLAUDE_API_KEY, test_mode=False)
```

### **Step 6: Download Your Excel File**
```python
from google.colab import files
files.download('teknopark_companies.xlsx')
```

## 🔑 **How to Get Claude API Key**

1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Click "API Keys" in the left menu
4. Click "Create Key"
5. Copy the key (starts with `sk-ant-api03-`)
6. Paste it in the code where it says `"YOUR_CLAUDE_API_KEY"`

## ⚠️ **IMPORTANT NOTES**

- **Use the ENTIRE `google_colab_setup.py` file** - don't use the other files
- Your API key should look like: `sk-ant-api03-xxxxxxxxxxxx`
- Keep your API key private and secure
- Test mode processes 5 companies (~2-3 minutes)
- Full mode processes all companies (~30-60 minutes)

## 🎯 **Final Result**

You'll get an Excel file with these columns:
- **Firma İsmi** (Company Name)
- **Website URL** (Company Website)  
- **E-mail** (Contact Email)
- **Telefon** (Phone Number)
- **Profil URL** (Teknopark Profile Link)
