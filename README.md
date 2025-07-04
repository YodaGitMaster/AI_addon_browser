# AI Page Summarizer - Firefox Addon

A Firefox addon that extracts content from web pages and generates concise summaries using Ollama's Gemma3 model.

## Features

- **Smart Content Extraction**: Automatically identifies and extracts main content from web pages
- **AI-Powered Summaries**: Uses Ollama's Gemma3 model for high-quality summarization
- **Privacy First**: All processing happens locally on your machine
- **Private Browsing Compatible**: Works in private browsing mode ("Never remember history")
- **Clean Interface**: Beautiful, modern popup interface
- **Error Handling**: Comprehensive error handling and status indicators
- **Summary Storage**: Saves summaries locally for future reference

## Prerequisites

1. **Ollama**: Install Ollama on your system
   - Download from [ollama.com](https://ollama.com/)
   - Install the Gemma3 model: `ollama pull gemma3`
   - Ensure Ollama is running on `localhost:11434`

2. **Firefox**: Compatible with Firefox 109+ (uses Firefox-specific Manifest V3 format)

## Installation

### Method 1: Developer Mode (Recommended for testing)

1. **Clone/Download** this repository
2. **Generate Icons** (choose one method):
   - **Auto Method**: Open `create-icons.html` (auto-generates and downloads all icons)
   - **Manual Method**: Open `generate-icons.html` and download each icon individually
   - **SVG Only**: Use the provided SVG icon (may have limited compatibility)
3. **Load in Firefox**:
   - Open Firefox and go to `about:debugging`
   - Click "This Firefox" in the left sidebar
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from this directory

### Method 2: Package and Install

1. **Package the addon**:
   ```bash
   # Create a zip file with all addon files
   zip -r ai-page-summarizer.zip . -x "context/*" "*.git*" "generate-icons.html" "README.md"
   ```

2. **Install in Firefox**:
   - Go to `about:addons`
   - Click the gear icon and select "Install Add-on From File"
   - Select the zip file

## Usage

1. **Start Ollama**: Make sure Ollama is running with the Gemma3 model
   ```bash
   ollama serve
   ```

2. **Navigate to a webpage** you want to summarize

3. **Click the addon icon** in the Firefox toolbar

4. **Click "Summarize Page"** in the popup

5. **Wait for the summary** to appear (usually 10-30 seconds)

## How It Works

1. **Content Extraction**: The content script analyzes the page DOM and extracts the main content, filtering out navigation, ads, and other noise
2. **API Communication**: The popup script sends the extracted content to your local Ollama instance
3. **AI Processing**: Ollama's Gemma3 model generates a concise summary
4. **Display**: The summary is displayed in a clean, readable format in the popup

## Configuration

The addon uses these default settings:

- **Ollama URL**: `http://localhost:11434`
- **Model**: `gemma3`
- **Max Content Length**: 5000 characters
- **Request Timeout**: 30 seconds

To modify these settings, edit the `OLLAMA_CONFIG` object in `background.js`.

## File Structure

```
AI_addon_browser/
├── manifest.json          # Addon configuration (Firefox-specific Manifest V3)
├── content-script.js      # Page content extraction
├── popup.html            # Popup interface
├── popup.css             # Popup styling
├── popup.js              # Popup logic & Ollama API communication
├── icons/                # Addon icons
│   ├── icon.svg          # SVG icon
│   ├── icon-16.png       # 16x16 PNG icon
│   ├── icon-32.png       # 32x32 PNG icon
│   ├── icon-48.png       # 48x48 PNG icon
│   └── icon-128.png      # 128x128 PNG icon
├── generate-icons.html   # Icon generation tool
└── README.md            # This file
```

## Troubleshooting

### Private Browsing Mode

- **Good News**: This addon works in private browsing mode!
- **No Configuration Needed**: Keep your "Never remember history" setting if preferred
- **Full Functionality**: All features work without background scripts

### "Ollama Disconnected" Status

- Ensure Ollama is running: `ollama serve`
- Check if Gemma3 model is installed: `ollama list`
- Verify Ollama is accessible at `http://localhost:11434`

### "Could not connect to Ollama" Error

- Check if Ollama is running on the correct port
- Verify firewall settings aren't blocking localhost connections
- Try restarting Ollama

### Content Extraction Issues

- Some pages may have complex layouts that affect extraction
- The addon works best on article-style pages
- Try refreshing the page and trying again

### Permission Errors

- Ensure the addon has been granted all requested permissions
- Try reloading the addon in `about:debugging`

### Manifest Errors

- This addon is specifically designed for Firefox (uses Firefox-specific Manifest V3)
- For Chrome, the manifest would need modifications (service_worker instead of scripts)

## Privacy & Security

- **No External Services**: All processing happens locally
- **No Data Collection**: No user data is collected or transmitted
- **Local Storage Only**: Summaries are stored locally in your browser
- **Content Filtering**: Only main content is extracted, not personal information

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the troubleshooting section above
- Review browser console logs for error details
- Ensure Ollama is properly configured and running

## License

This project is open source. Feel free to use, modify, and distribute as needed.

## Changelog

### v1.0.0
- Initial release
- Content extraction from web pages
- Ollama Gemma3 integration
- Clean popup interface
- Local summary storage
- Error handling and status indicators 