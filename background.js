// AI Page Chat Background Script
console.log('AI Page Chat background script loaded');

// Track open windows to prevent duplicates
let chatWindow = null;

// Handle extension icon click
browser.action.onClicked.addListener(async () => {
    console.log('Extension icon clicked');
    
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
});

// Handle extension installation
browser.runtime.onInstalled.addListener(() => {
    console.log('AI Page Chat extension installed');
}); 