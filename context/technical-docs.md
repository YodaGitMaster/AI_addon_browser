# AI Page Chat - Technical Documentation

This document provides an in-depth technical overview of the AI Page Chat Firefox addon, detailing its architecture, core components, data flow, and the inner workings of its key features. It's intended for developers looking to understand, modify, or extend the addon.

## 1. Architecture Overview

The AI Page Chat addon follows a distributed architecture, typical for browser extensions, with distinct responsibilities for each component:

-   **`manifest.json`**: The heart of the extension, defining its permissions, entry points, and capabilities.
-   **`content-script.js`**: Injected into web pages to interact directly with the DOM, extract content, and capture screenshots.
-   **`sidebar.html` / `sidebar.css` / `sidebar.js`**: Form the user-facing chat interface. `sidebar.js` handles all UI logic, user interactions, and communication with the `background.js` script.
-   **`background.js`**: Acts as a persistent event listener and message broker. It manages context menus and routes messages between the `sidebar.js` and `content-script.js`, as well as facilitating direct communication with the local Ollama API.
-   **Ollama Server**: An external, locally running AI model server (e.g., `ollama serve`) that performs the actual AI inference based on prompts and images received from the addon.

### High-Level Data Flow:

```mermaid
graph TD
    User[User Interaction] -->|Clicks Addon Icon / Right-Click| Sidebar.js
    Sidebar.js -->|Requests Page Content| Background.js
    Background.js -->|Sends 'extractContent' Message| Content-script.js
    Content-script.js -->|Extracts HTML/Text/Images| Background.js
    Background.js -->|Sends Content| Sidebar.js
    Sidebar.js -->|Displays Page Info & Input|
    User -->|Types Message / Clicks Suggestion / Selects Images| Sidebar.js
    Sidebar.js -->|Prepares Prompt & Image Data| Background.js
    Background.js -->|Sends Prompt & Images| OllamaServer[Local Ollama Server]
    OllamaServer -->|Processes with AI Model| OllamaServer
    OllamaServer -->|Returns AI Response| Background.js
    Background.js -->|Sends AI Response| Sidebar.js
    Sidebar.js -->|Renders AI Message|
```

## 2. Core Components & Interactions

### 2.1. `manifest.json`

This file defines the addon's metadata, permissions, and script registrations.

-   **`manifest_version: 3`**: Specifies Manifest V3, Firefox's current standard for extensions.
-   **`permissions`**: Key permissions include:
    -   `activeTab`: Grants temporary access to the currently active tab when the addon icon is clicked.
    -   `tabs`: Essential for querying all open tabs (e.g., for multi-tab context selection) and injecting content scripts.
    -   `storage`: For local storage of chat history.
    -   `contextMenus`: To create and manage right-click context menu options.
-   **`host_permissions`**: `http://localhost:11434/*` is crucial to allow the addon to make network requests to your local Ollama server, bypassing CORS restrictions.
-   **`content_scripts`**: Registers `content-script.js` to run on all `*<all_urls>*`.
-   **`action`**: Defines the addon's toolbar button and its default HTML (`sidebar.html`).
-   **`background`**: Registers `background.js` as the persistent background script for event handling (e.g., context menu clicks).

### 2.2. `content-script.js`

This script runs within the context of the active web page and is responsible for all DOM interactions.

#### Key Functions:

-   **`extractPageContent(includeScreenshots)`**: This is the primary function. It orchestrates content extraction:
    1.  **Prioritized Element Selection**: Attempts to find content within `<article>`, then `<main>`, falling back to the entire `<body>` if these are not found.
    2.  **Comprehensive Filtering**: Removes irrelevant elements such as navbars, sidebars, footers, ads, social share buttons, comments, etc. This ensures the AI receives clean, focused content.
        -   Uses a detailed list of CSS selectors (`unwantedSelectors`) to identify and remove noise elements.
        -   Also filters out very small text blocks (less than 10 characters) which are usually irrelevant.
    3.  **Table Extraction**: Identifies `<table>` elements and extracts their HTML content.
    4.  **Chart/Image Detection & Screenshot (Conditional)**:
        -   If `includeScreenshots` is `true`, it uses `html2canvas` (though `html2canvas` itself is not directly included, the logic indicates its intended use or a similar screenshot library) to capture screenshots of detected charts or relevant visual elements.
        -   `detectCharts()` identifies potential chart/graph elements on the page.
    5.  **Returns**: An object containing `title`, `url`, `textContent`, `tables`, and `charts` (with optional `screenshot` data).

#### Interactions:

-   **Listens for `'extractContent'` message**: The `background.js` or `sidebar.js` sends this message to trigger content extraction.
-   **Sends response back**: Returns the extracted data via `browser.runtime.sendMessage`.

### 2.3. `sidebar.js` (The Chat Interface)

This is the main script for the user interface, handling chat logic, UI updates, and most user interactions.

#### Key Responsibilities:

-   **Initialization (`DOMContentLoaded` listener)**:
    -   Calls `checkOllamaStatus()` to verify Ollama server and model availability.
    -   Calls `loadPageContext()` to initially load content from the current active tab.
    -   Sets up all event listeners for buttons and input fields.
-   **Chat Message Management (`addMessage`)**: Dynamically creates and appends chat bubbles (user, AI, system, error) to the `#chatMessages` container. It handles markdown rendering.
-   **Input Handling (`handleSendMessage`)**: Processes user input, clears the input field, prepares the prompt, and initiates the AI call.
-   **Ollama API Communication (`sendMessageWithImages`, `callOllamaAPIWithImages`)**:
    -   Constructs the full prompt, including page context, chat history, and image data (if any).
    -   Makes `fetch` requests to the local Ollama server (`http://localhost:11434/api/generate`).
    -   Handles `isProcessing` state, typing indicators, and error display.
-   **Markdown Rendering (`renderMarkdown`, `convertMarkdownTables`, `parseMarkdownTable`)**:
    -   A custom, lightweight markdown parser that converts markdown text into HTML for display.
    -   **Crucially includes `convertMarkdownTables` and `parseMarkdownTable`** functions to correctly render markdown table syntax (`| header |` `|---|`) into HTML `<table>` elements.
    -   Handles code blocks, headers, bold, italics, links, blockquotes, and lists.
-   **Image Management (`showImageManagerModal`, `updateDraftMessageImages`)**:
    -   Presents a modal for users to select (via checkboxes) which detected images/screenshots to send to the AI.
    -   Manages `window.pendingImages` to track selected images.
-   **Multi-Tab Context Selection (`handleEditContext`, `showTabSelectionModal`, `loadMultiTabContext`, `updateContextDisplay`)**:
    -   **`handleEditContext`**: Triggered by the "Edit Context" button. Queries all web tabs via `browser.tabs.query()`.
    -   **`showTabSelectionModal`**: Creates and displays a modal with a list of checkboxes for each available web tab (title, URL, pre-selecting the current tab).
    -   **`loadMultiTabContext`**: Iterates through selected `tabId`s, sends `extractContent` messages to each tab (injecting `content-script.js` if necessary), and combines all extracted text content into a single `currentPageContext` string.
    -   **`updateContextDisplay`**: Updates the sidebar's page title and URL to reflect whether a single tab or multiple tabs are providing context.
-   **Chat History Management (`saveChatHistory`, `generateMarkdownExport`, `showExportModal`)**:
    -   Saves conversation exchanges to `browser.storage.local`.
    -   Generates markdown format of the chat history.
    -   Provides an export modal with copy-to-clipboard and download options.
-   **Event Listeners**: Manages all button clicks, input changes, and keyboard events.

### 2.4. `background.js` (The Event Manager)

This script runs persistently in the background and primarily handles browser-level events and message routing.

#### Key Responsibilities:

-   **Context Menu Creation (`createContextMenus`)**:
    -   Registers various right-click context menu items (e.g., "AI Chat", "Fact Check", "Summarize Page").
    -   These menus are associated with `page` and `selection` contexts.
-   **Message Listening (`browser.runtime.onMessage.addListener`)**:
    -   Listens for messages from `content-script.js` (e.g., extracted content) and `sidebar.js` (e.g., requests for page content or AI analysis).
    -   Crucially, it acts as a **message router**, forwarding messages between different parts of the extension (e.g., a request from `sidebar.js` for content goes to `content-script.js` via `browser.tabs.sendMessage`).
    -   Handles `'contextMenuAction'` messages, populating the sidebar input with a pre-defined prompt based on the selected context menu item.

## 3. Data Flow Deep Dive

### 3.1. Initial Page Context Loading:

1.  **`sidebar.js` (DOMContentLoaded)**: When the sidebar loads, it calls `loadPageContext()`.
2.  **`loadPageContext()`**: Queries active web tabs (`browser.tabs.query({ active: true })`).
3.  **`sidebar.js` to `content-script.js`**: Sends `action: 'extractContent', includeScreenshots: false` message to the `content-script.js` of the active tab via `browser.tabs.sendMessage(tab.id, ...)`.
4.  **`content-script.js`**: Receives the message, executes `extractPageContent(false)`.
5.  **`content-script.js` to `sidebar.js`**: Returns the `textContent`, `title`, `url`, `tables`, and `charts` back to `sidebar.js`.
6.  **`sidebar.js`**: Stores this data in `currentPageContext` and updates the UI (page title/URL).

### 3.2. User Sending a Message (Text Only):

1.  **User Action**: Types in `#messageInput` and clicks `#sendButton` (triggers `handleSendMessage`).
2.  **`handleSendMessage`**: Retrieves user message, calls `createContextPrompt(userMessage)`.
3.  **`createContextPrompt`**: Constructs the full prompt string using `currentPageContext.content`, `currentPageContext.tables`, `currentPageContext.charts`, and recent `chatHistory`. It determines `needsVisualAnalysis` based on keywords in `userMessage`.
4.  **`handleSendMessage`**: Calls `sendMessageWithImages(userMessage, [])` (no images for text-only).
5.  **`sendMessageWithImages`**: Calls `callOllamaAPIWithImages(userMessage, [])`.
6.  **`callOllamaAPIWithImages`**: Sends `fetch` request to `http://localhost:11434/api/generate` with the generated prompt.
7.  **Ollama Server**: Processes the request and returns a response.
8.  **`callOllamaAPIWithImages`**: Receives the response, parses it.
9.  **`sidebar.js`**: `addMessage('ai', ...)` displays the AI's response, then saves `chatHistory`.

### 3.3. User Sending a Message (With Images/Charts):

1.  **User Action**: Types a message with visual keywords (e.g., "analyze chart") or clicks a relevant quick action button.
2.  **`handleSendMessage`**: Calls `createContextPrompt(userMessage)`. This time, `needsVisualAnalysis` will be `true`.
3.  **`createContextPrompt`**: If `needsVisualAnalysis` is `true` and `currentPageContext.charts` does not contain screenshots, it sends an `'extractContent', includeScreenshots: true` message to the `content-script.js` of the active tab.
    -   `content-script.js` captures screenshots of detected charts/images using `html2canvas` (or similar logic) and returns them.
    -   `currentPageContext.charts` is updated with `screenshot` data.
    -   `images` array is populated with base64 encoded screenshots.
4.  **`handleSendMessage`**: A draft message is created (`addMessage('user', userMessage, [], true)`) with the `'Select Images'`, `'Send'`, and `'Cancel'` buttons.
    -   The `images` are stored in `window.pendingImages`.
5.  **User Interaction**: Clicks `'Select Images'` button (triggers `showImageManagerModal`).
6.  **`showImageManagerModal`**: Displays a modal with checkboxes for all detected `window.pendingImages`. Users select desired images.
7.  **User Action**: Clicks `'Send'` button in the draft message.
8.  **`sendButton.onclick` handler**: Retrieves currently selected images from the draft message's DOM, calls `sendMessageWithImages(userMessage, selectedImages)`.
9.  **`sendMessageWithImages`**: Removes the draft message from the UI, clears `window.pendingImages`, and calls `callOllamaAPIWithImages(userMessage, apiImages)`.
10. **`callOllamaAPIWithImages`**: Sends the prompt and base64 encoded images to Ollama.
11. **Ollama Server**: Processes multimodal input and returns a response.
12. **`sidebar.js`**: Displays AI response, updates `chatHistory`.

### 3.4. Multi-Tab Context Selection:

1.  **User Action**: Clicks the "Edit Context" button (triggers `handleEditContext`).
2.  **`handleEditContext`**: Queries `browser.tabs.query({})` to get *all* open tabs. Filters them for valid web pages.
3.  **`showTabSelectionModal(webTabs)`**: Displays a modal listing all valid web tabs with checkboxes.
4.  **User Action**: Selects multiple tabs and clicks "Apply Selected Tabs".
5.  **`applyBtn.onclick` handler**: Gets `selectedTabIds` from the checkboxes. Calls `loadMultiTabContext(selectedTabIds)`.
6.  **`loadMultiTabContext`**: Iterates through `selectedTabIds`.
    -   For each `tabId`, it first tries `browser.tabs.sendMessage` to `'extractContent'`.
    -   If the content script is not yet injected (e.g., for inactive tabs), it uses `browser.tabs.executeScript(tabId, { file: 'content-script.js' })` to inject it, waits briefly, and then retries the `sendMessage`.
    -   Collects `title`, `url`, and `textContent` from each selected tab.
7.  **`loadMultiTabContext`**: Combines the `textContent` from all selected tabs into a single, comprehensive `currentPageContext.content` string, prepending each section with `--- Tab Title ---`. It also combines `tables` and `charts` arrays.
8.  **`updateContextDisplay()`**: Updates the sidebar's page title and URL to indicate that multiple tabs are selected as context (e.g., "3 tabs selected").
9.  **Subsequent User Messages**: The `createContextPrompt` function will now use this combined `currentPageContext.content` for all AI queries, providing the AI with a much broader context.

## 4. Key Global Variables and State Management

-   **`currentPageContext`**: Object (`{ title, url, content, tables, charts, multiTab, tabContexts }`) holding the current page's (or selected tabs') extracted data. This is crucial for providing context to the AI.
    -   `multiTab`: Boolean indicating if context is from multiple tabs.
    -   `tabContexts`: Array of individual tab contexts when `multiTab` is true.
-   **`chatHistory`**: Array of objects (`{ user, ai, timestamp }`) storing all conversation exchanges. Used for providing past conversation context to the AI and for export.
-   **`isProcessing`**: Boolean flag (`true`/`false`) to prevent multiple AI requests simultaneously and manage UI states (e.g., disable send button, show typing indicator).
-   **`window.pendingImages`**: Temporary global array to hold base64 encoded image data detected for a user message, allowing the user to select/deselect them before sending. Cleared after send or cancel.

## 5. Error Handling Mechanisms

The addon includes robust error handling for a better user experience:

-   **Ollama Connection**: `checkOllamaStatus()` handles network errors and model availability, updating the status indicator and disabling the send button if Ollama is not ready.
-   **Content Extraction**: Catches errors during `browser.tabs.sendMessage` and `executeScript`, displaying user-friendly error messages if content cannot be loaded.
-   **API Communication**: `callOllamaAPIWithImages()` includes `try-catch` blocks for `fetch` errors and checks for `response.ok` to handle HTTP errors from the Ollama server.
-   **User Feedback**: `addMessage('error', ...)` function is used consistently to display critical errors directly in the chat interface.
-   **UI State**: `isProcessing` flag ensures buttons are disabled during AI processing to prevent duplicate requests.

This documentation covers the main technical aspects of the AI Page Chat addon. For specific code details, refer directly to the source files. 