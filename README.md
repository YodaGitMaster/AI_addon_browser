# AI Page Chat - Firefox Addon

A powerful Firefox addon that transforms your browsing experience by integrating with local AI models (like Ollama's Gemma3) to provide advanced page analysis, multi-tab context, and multimodal chat capabilities.

## ✨ Features

-   **AI-Powered Chat**: Engage in continuous conversations about web page content using your local Ollama model.
-   **Smart Content Extraction**: Automatically identifies and extracts the main content, filtering out navigation, ads, and other noise for focused analysis.
-   **Multi-Tab Context**: Select and combine content from multiple open browser tabs for comprehensive analysis and comparison.
-   **Multimodal Analysis**: Analyze images, charts, and visual data on the page with AI, supporting image-based queries.
-   **Quick Action Buttons**: Pre-defined prompts for common tasks like summarizing, extracting key points, fact-checking, and more.
-   **Enhanced Markdown Rendering**: AI responses are beautifully formatted with full markdown support, including professional tables, code blocks, and lists.
-   **Privacy First**: All AI processing happens locally on your machine – your data never leaves your computer.
-   **Persistent Window**: The chat interface is a standalone, draggable, and resizable window that remains open across interactions.
-   **Export Chat**: Export your conversations as markdown files for easy sharing or documentation.
-   **Private Browsing Compatible**: Works seamlessly in Firefox's private browsing mode.
-   **Comprehensive Error Handling**: Clear status indicators and error messages for a smooth experience.

## 💻 System Requirements

To run this addon efficiently, especially with local AI models like Gemma3:

-   **Operating System**: Windows 10/11, macOS (M1/M2/M3 recommended), Linux.
-   **RAM**:
    -   **Minimum**: 8 GB (may experience slower performance with larger models).
    -   **Recommended**: 16 GB or more for smoother, faster interactions and to support larger AI models (e.g., Gemma3:8b).
-   **Storage**: At least 5-10 GB free space for Ollama models (Gemma3:4b is ~2.3GB).
-   **Processor**: Modern multi-core CPU (Intel i5/Ryzen 5 equivalent or better).
-   **GPU (Optional but Recommended)**: A dedicated GPU with at least 6GB VRAM (NVIDIA or AMD) can significantly accelerate AI model inference, leading to much faster responses.

## 🚀 Prerequisites

1.  **Ollama**: Install Ollama on your system.
    -   Download from [ollama.com](https://ollama.com/)
    -   **Important**: This addon requires Ollama to be accessible from your browser extension. Before running `ollama serve`, set the `OLLAMA_ORIGINS` environment variable.
        -   **Windows PowerShell**: `$env:OLLAMA_ORIGINS='*'; ollama serve`
        -   **Linux/macOS (Bash/Zsh)**: `OLLAMA_ORIGINS='*' ollama serve`
    -   Install the recommended model (Gemma3:4b): `ollama pull gemma3:4b` (or `ollama pull gemma3` for the default size)
    -   Ensure Ollama is running on `http://localhost:11434`.

2.  **Firefox**: Compatible with Firefox 109+ (uses Firefox-specific Manifest V3 format).

## 🛠️ Installation

### Method 1: Developer Mode (Recommended for Development & Testing)

1.  **Clone/Download** this repository to your local machine.
2.  **Generate Icons** (choose one method):
    -   **Auto Method**: Open `create-icons.html` in your browser (it will auto-generate and download all necessary icons into the `icons/` directory).
    -   **Manual Method**: Open `generate-icons.html` in your browser and download each icon individually into the `icons/` directory.
    -   *(Alternatively, you can use the provided PNG icons directly if they are suitable).*
3.  **Load in Firefox**:
    -   Open Firefox and type `about:debugging` into the address bar.
    -   Click on **"This Firefox"** in the left sidebar.
    -   Click the **"Load Temporary Add-on..."** button.
    -   Navigate to the cloned repository directory and select the `manifest.json` file.
    -   The addon will now appear in your Firefox toolbar.

### Method 2: Package and Install (For Distribution)

1.  **Package the addon**: Navigate to the addon's root directory in your terminal and run:
    ```bash
    zip -r ai-page-chat.zip . -x "context/*" "*.git*" "create-icons.html" "generate-icons.html" "README.md" "RELOAD_EXTENSION.md"
    ```
    This command creates a `.zip` file containing all necessary addon files while excluding development/documentation files.
2.  **Install in Firefox**:
    -   Open Firefox and type `about:addons` into the address bar.
    -   Click the **gear icon** (⚙️) on the `about:addons` page.
    -   Select **"Install Add-on From File..."**.
    -   Browse to and select the `ai-page-chat.zip` file you created.

## 📖 How to Use

1.  **Start Ollama Server**: Ensure Ollama is running in your terminal with the `OLLAMA_ORIGINS='*'` environment variable set (as described in [Prerequisites](#prerequisites)). Confirm the `gemma3:4b` (or your chosen model) is pulled and available.
    ```bash
    OLLAMA_ORIGINS='*' ollama serve
    ```
2.  **Navigate to a Webpage**: Open any webpage in Firefox that you wish to analyze or chat about.
3.  **Open the AI Chat Sidebar**: Click the "AI Page Chat" icon in your Firefox toolbar. This will open the standalone chat sidebar.
4.  **Interact with AI**:
    -   **Send Custom Messages**: Type your question or prompt into the input field at the bottom and click the send button.
    -   **Use Quick Action Buttons**: Below the input field, click any of the pre-defined "suggestion buttons" for common tasks like "Summarize this page", "Extract Tables", or "Compare Products".
    -   **Context Menu (Right-Click)**: Right-click on any selected text or on the page itself to access quick AI analysis options directly from Firefox's context menu.
5.  **Multi-Tab Context**:
    -   Click the **"Edit Context"** button in the sidebar header.
    -   A modal will appear showing all open web tabs. Select the tabs you wish to include in the AI's context.
    -   Click "Apply Selected Tabs" to load combined content from chosen tabs into the AI's memory for a broader analysis.
6.  **Image Selection**:
    -   If a message involves visual analysis keywords (e.g., "analyze chart", "what's in this image"), the addon may automatically attempt to capture screenshots.
    -   You will see a draft message with "Select Images" button. Click it to choose which detected images/screenshots to send to the AI. Only selected images will be sent.
7.  **Export Chat**: Click the "Export" button in the sidebar header to download your conversation history as a markdown file.

## ⚙️ How It Works (Brief Overview)

This addon operates by facilitating communication between your Firefox browser and a local Ollama server:

1.  **Content Script (`content-script.js`)**: Injects into web pages to intelligently extract text content, tables, and (on demand) screenshots/chart data. It filters out irrelevant elements like navigation, ads, and footers to provide clean context.
2.  **Sidebar Script (`sidebar.js`)**: Manages the main chat interface, handles user input, displays messages (with rich markdown rendering for tables, code, etc.), and communicates with the background script. It also orchestrates multi-tab context selection and image management.
3.  **Background Script (`background.js`)**: Acts as a central hub, managing context menus and routing messages between the sidebar, content scripts, and the Ollama API.
4.  **Ollama API**: The `sidebar.js` (via background.js) sends the prepared text context and selected image data to your local Ollama instance (e.g., `http://localhost:11434/api/generate`).
5.  **AI Processing**: Your local Ollama model (e.g., Gemma3:4b) processes the input and generates a response.
6.  **Display**: The AI's response is received and rendered in the chat interface, incorporating enhanced markdown visualization.

## 📂 File Structure

```
AI_addon_browser/
├── manifest.json          # Addon configuration (Firefox-specific Manifest V3)
├── content-script.js      # Page content extraction & screenshot capture logic
├── sidebar.html           # Main chat interface HTML
├── sidebar.css            # Styling for the chat interface and custom elements
├── sidebar.js             # Core chat logic, Ollama API comms, multi-tab, image management
├── background.js          # Context menu management and message routing
├── icons/                 # Addon icons (16, 32, 48, 128 px)
│   ├── icon.svg          # Original SVG icon (for regeneration)
│   └── ... (generated PNGs)
├── create-icons.html      # Tool to auto-generate PNG icons from SVG
├── generate-icons.html    # Manual tool to generate PNG icons from SVG
├── README.md              # This file
├── RELOAD_EXTENSION.md    # Instructions for reloading addon
└── context/               # Internal documentation for AI (state, schema, decisions, insights)
    ├── state.md
    ├── schema.md
    ├── decisions.md
    └── insights.md
```

## Troubleshooting

### "Ollama Disconnected" Status / "Could not connect to Ollama" Error

-   **Ensure Ollama is running**: Open your terminal and run `OLLAMA_ORIGINS='*' ollama serve` (important for extension access).
-   **Verify Model**: Check if the `gemma3:4b` (or your chosen) model is installed by running `ollama list`. If not, `ollama pull gemma3:4b`.
-   **Firewall**: Ensure your firewall isn't blocking connections to `localhost:11434`.
-   **Restart Ollama**: Sometimes a simple restart of the Ollama server helps.

### Content Extraction Issues

-   Some complex page layouts might affect extraction.
-   The addon works best on article-style or content-heavy pages.
-   Try refreshing the page and then opening the addon again.

### UI / Styling Not Updating After Changes

-   Firefox extensions heavily cache files. After making code changes (especially to HTML or CSS), you **MUST reload the addon** in Firefox.
    1.  Go to `about:debugging` in Firefox.
    2.  Click **"This Firefox"** on the left.
    3.  Find your addon ("AI Page Chat") and click the **"Reload"** button next to it.

### Permission Errors

-   Ensure the addon has been granted all requested permissions during installation.
-   If issues persist, try removing and re-installing the addon.

## Privacy & Security

-   **No External Services**: All AI processing is performed entirely on your local machine via Ollama. No user data or page content is sent to external servers.
-   **No Data Collection**: This addon does not collect, store, or transmit any of your personal data or browsing activity.
-   **Local Storage Only**: Chat history and temporary content contexts are stored only in your browser's local storage.
-   **Content Filtering**: The content extraction process focuses only on main textual content and ignores potentially sensitive elements unless explicitly included (e.g., images for multimodal analysis).

## Contributing

We welcome contributions! If you'd like to improve this addon:
1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and ensure they are well-tested.
4.  Submit a pull request with a clear description of your changes.

## Support

For issues, questions, or feedback:
-   Refer to the [Troubleshooting](#troubleshooting) section.
-   Check the browser console logs (`F12` in Firefox) for error details when the addon is open.
-   Ensure Ollama is properly configured and running on your system.
-   Open an issue on the GitHub repository.

## License

This project is open source and available under the [MIT License](LICENSE.md). Feel free to use, modify, and distribute as needed.

## Changelog

### v1.1.0 (Current Version)
-   **Multi-Tab Context Selection**: Added feature to select and combine context from multiple tabs.
-   **Enhanced Markdown Table Rendering**: Implemented robust markdown table parsing and beautiful CSS styling for tables.
-   **Expanded Quick Actions**: Added 10+ new quick action buttons for diverse use cases, reorganized for usage frequency.
-   **Improved "Edit Context" Button Styling**: Modern gradient, animations, and hover effects.
-   **Refined Prompts**: Updated various prompts for clearer AI instructions and better markdown table output.
-   **Updated Documentation**: Comprehensive README with detailed usage, hardware requirements, and troubleshooting.

### v1.0.0
-   Initial release with core AI page summarization.
-   Ollama Gemma3 integration.
-   Standalone, draggable, resizable chat window.
-   Basic content extraction, image selection, and chat history.
-   Context menu integration. 