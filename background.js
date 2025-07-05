// AI Page Chat Background Script
console.log('AI Page Chat background script loaded');

// Track open windows to prevent duplicates
let chatWindow = null;

// Handle extension icon click
browser.action.onClicked.addListener(async () => {
    console.log('=== EXTENSION ICON CLICKED ===');
    console.log('Opening chat window...');
    console.log('Stack trace:', new Error().stack);
    await openChatWindow();
    console.log('Chat window opened');
});

// Handle extension installation
browser.runtime.onInstalled.addListener(() => {
    console.log('AI Page Chat extension installed');
    
    // Create context menu items
    createContextMenus();
});

// Handle messages from content script and sidebar
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'captureScreenshot') {
        // Capture visible tab screenshot
        browser.tabs.captureVisibleTab(null, {format: 'png'}, (dataUrl) => {
            if (browser.runtime.lastError) {
                console.error('Screenshot capture failed:', browser.runtime.lastError);
                sendResponse({screenshot: null});
            } else {
                sendResponse({screenshot: dataUrl});
            }
        });
        return true; // Keep message channel open for async response
    }
});

// Create context menu items
function createContextMenus() {
    // Remove existing context menu items
    browser.contextMenus.removeAll(() => {
        // Main AI Chat option
        browser.contextMenus.create({
            id: 'ai-chat',
            title: 'AI Chat',
            contexts: ['page', 'selection']
        });
        
        // Separator
        browser.contextMenus.create({
            id: 'separator1',
            type: 'separator',
            contexts: ['page', 'selection']
        });
        
        // AI Analysis submenu
        browser.contextMenus.create({
            id: 'ai-analysis',
            title: 'AI Analysis',
            contexts: ['page', 'selection']
        });
        
        // Fact check
        browser.contextMenus.create({
            id: 'fact-check',
            parentId: 'ai-analysis',
            title: 'Fact Check',
            contexts: ['page', 'selection']
        });
        
        // Extract tables
        browser.contextMenus.create({
            id: 'extract-tables',
            parentId: 'ai-analysis',
            title: 'Extract Tables',
            contexts: ['page']
        });
        
        // Financial analysis
        browser.contextMenus.create({
            id: 'financial-analysis',
            parentId: 'ai-analysis',
            title: 'Quick Financial Analysis',
            contexts: ['page', 'selection']
        });
        
        // Chart analysis
        browser.contextMenus.create({
            id: 'chart-analysis',
            parentId: 'ai-analysis',
            title: 'Analyze Charts',
            contexts: ['page', 'selection']
        });
        
        // Summarize Page
        browser.contextMenus.create({
            id: 'summarize-page',
            parentId: 'ai-analysis',
            title: 'Summarize this page',
            contexts: ['page']
        });

        // Quick Summary
        browser.contextMenus.create({
            id: 'quick-summary',
            parentId: 'ai-analysis',
            title: 'Do a quick summary',
            contexts: ['page', 'selection']
        });

        // Find Key Information
        browser.contextMenus.create({
            id: 'find-key-information',
            parentId: 'ai-analysis',
            title: 'Find Key Information',
            contexts: ['page', 'selection']
        });

        // Main Points
        browser.contextMenus.create({
            id: 'main-points',
            parentId: 'ai-analysis',
            title: 'What are the main points? (bullet points)',
            contexts: ['page', 'selection']
        });

        // Take Notes
        browser.contextMenus.create({
            id: 'take-notes',
            parentId: 'ai-analysis',
            title: 'Take Notes',
            contexts: ['page', 'selection']
        });
    });
}

// Handle context menu clicks
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log('=== CONTEXT MENU CLICKED ===');
    console.log('Menu ID:', info.menuItemId);
    console.log('Selection text:', info.selectionText);
    console.log('Page URL:', info.pageUrl);
    console.log('Tab info:', tab);
    console.log('Full info object:', info);
    console.log('Stack trace:', new Error().stack);
    
    // Open chat window first
    await openChatWindow();
    
    // Send message to chat window with specific action
    setTimeout(() => {
        browser.tabs.query({url: browser.runtime.getURL('sidebar.html')}, (tabs) => {
            if (tabs.length > 0) {
                browser.tabs.sendMessage(tabs[0].id, {
                    action: 'contextMenuAction',
                    menuItemId: info.menuItemId,
                    selectedText: info.selectionText || '',
                    pageUrl: tab.url
                });
            }
        });
    }, 1000); // Wait for chat window to load
});

// Extracted function to open chat window
async function openChatWindow() {
    // If window already exists, focus it instead of creating new one
    if (chatWindow) {
        try {
            const window = await browser.windows.get(chatWindow.id);
            await browser.windows.update(chatWindow.id, { focused: true });
            return;
        } catch (error) {
            // Window was closed, clear reference
            chatWindow = null;
        }
    }
    
    // Create new standalone window
    try {
        chatWindow = await browser.windows.create({
            url: browser.runtime.getURL('sidebar.html'),
            type: 'popup',  // Creates a standalone window
            width: 520,     // Slightly wider to accommodate header
            height: 750,    // Taller to show full interface
            left: 100,      // Position from left edge
            top: 100,       // Position from top edge
            focused: true   // Bring window to front
        });
        
        console.log('Chat window created:', chatWindow.id);
        
        // Listen for window close to clear reference
        browser.windows.onRemoved.addListener((windowId) => {
            if (chatWindow && windowId === chatWindow.id) {
                chatWindow = null;
                console.log('Chat window closed');
            }
        });
        
    } catch (error) {
        console.error('Error creating chat window:', error);
    }
} 