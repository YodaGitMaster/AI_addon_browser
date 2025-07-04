# 🔄 RELOAD EXTENSION INSTRUCTIONS

## Firefox Extension Reload Steps:

### **Method 1: Quick Reload**
1. **Open Firefox**
2. **Type in address bar:** `about:debugging`
3. **Click:** "This Firefox" (left sidebar)
4. **Find:** "AI Page Summarizer" extension
5. **Click:** "Reload" button next to it

### **Method 2: Complete Reinstall**
1. **Go to:** `about:debugging`
2. **Click:** "This Firefox"
3. **Find:** "AI Page Summarizer" 
4. **Click:** "Remove" button
5. **Click:** "Load Temporary Add-on"
6. **Select:** `manifest.json` file from this folder

## ✅ **Verification Steps:**
After reloading, open the extension popup and check:
- Console shows: "Checking Ollama status and model availability..."
- Status shows: "Ollama Connected" with green dot
- Button is enabled
- Summarization works without 403 errors

## 🐛 **Still Having Issues?**
If you still see 403 errors after reloading, the extension cache might be stuck. Try:
1. Close Firefox completely
2. Restart Firefox
3. Reload extension again 