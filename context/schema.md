# Data Structures & Schema

## File Structure
```
AI_addon_browser/
├── manifest.json (addon config)
├── content-script.js (page content extraction)
├── background.js (API communication)
├── popup.html (UI structure)
├── popup.css (UI styling)
├── popup.js (UI logic)
├── icons/ (addon icons)
└── context/ (documentation)
```

## Key Data Formats

### Page Content Object
```javascript
{
  title: string,
  url: string,
  textContent: string,
  metadata: {
    description: string,
    keywords: string[],
    author: string
  }
}
```

### Ollama API Request
```javascript
{
  model: "gemma3",
  prompt: string,
  stream: false
}
```

### Ollama API Response
```javascript
{
  response: string,
  model: "gemma3",
  created_at: timestamp,
  done: boolean
}
```

## API Endpoints
- Ollama: http://localhost:11434/api/generate (default)

## Permissions Required
- activeTab (read current page)
- storage (save summaries)
- host permissions for Ollama API

## Message Types (Extension Communication)
- extractContent: trigger content extraction
- contentExtracted: send page content to background
- summaryReady: send summary to popup 