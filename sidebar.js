// AI Page Chat Sidebar Script
console.log('AI Page Chat sidebar loaded');

// Configuration
const OLLAMA_CONFIG = {
    baseUrl: 'http://localhost:11434',
    model: 'gemma3:latest',
    timeout: 30000
};

// Global variables
let currentPageContext = null;
let chatHistory = [];
let isProcessing = false;

// DOM elements
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    pageTitle: document.getElementById('pageTitle'),
    pageUrl: document.getElementById('pageUrl'),
    chatMessages: document.getElementById('chatMessages'),
    messageInput: document.getElementById('messageInput'),
    sendButton: document.getElementById('sendButton'),
    exportButton: document.getElementById('exportButton'),
    suggestionBtns: document.querySelectorAll('.suggestion-btn')
};

// Initialize sidebar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Sidebar initialized');
    
    // Check Ollama status
    await checkOllamaStatus();
    
    // Load current page context
    await loadPageContext();
    
    // Setup event listeners
    setupEventListeners();
    
    // Auto-focus input
    elements.messageInput.focus();
});

// Check Ollama status
async function checkOllamaStatus() {
    try {
        const versionResponse = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/version`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (!versionResponse.ok) {
            throw new Error('Ollama version check failed');
        }
        
        const modelsResponse = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (modelsResponse.ok) {
            const modelsData = await modelsResponse.json();
            const availableModels = modelsData.models || [];
            const modelExists = availableModels.some(model => model.name.startsWith(OLLAMA_CONFIG.model.split(':')[0]));
            
            if (modelExists) {
                updateStatus('connected', 'Ollama Connected');
                elements.sendButton.disabled = false;
            } else {
                updateStatus('warning', 'Model Not Available');
                elements.sendButton.disabled = true;
                addMessage('error', `Model '${OLLAMA_CONFIG.model}' not found. Run: ollama pull ${OLLAMA_CONFIG.model}`);
            }
        } else {
            updateStatus('warning', 'Cannot verify models');
            elements.sendButton.disabled = false;
        }
    } catch (error) {
        console.error('Error checking Ollama status:', error);
        updateStatus('disconnected', 'Ollama Disconnected');
        elements.sendButton.disabled = true;
        addMessage('error', 'Could not connect to Ollama. Please ensure it is running with: $env:OLLAMA_ORIGINS=\'*\'; ollama serve');
    }
}

// Update status indicator
function updateStatus(status, text) {
    elements.statusDot.className = `status-dot ${status}`;
    elements.statusText.textContent = text;
}

// Load page context
async function loadPageContext() {
    try {
        // Get the most recently active tab from any browser window
        const tabs = await browser.tabs.query({ active: true });
        
        // Filter out extension pages and find the actual webpage
        const webTabs = tabs.filter(tab => 
            !tab.url.startsWith('moz-extension://') && 
            !tab.url.startsWith('chrome-extension://') &&
            !tab.url.startsWith('about:') &&
            tab.url.startsWith('http')
        );
        
        if (webTabs.length > 0) {
            const tab = webTabs[0];
            
            // Get page content
            const contentResponse = await browser.tabs.sendMessage(tab.id, { action: 'extractContent' });
            
            if (contentResponse && contentResponse.success) {
                currentPageContext = {
                    title: contentResponse.data.title,
                    url: contentResponse.data.url,
                    content: contentResponse.data.textContent
                };
                
                // Update UI
                elements.pageTitle.textContent = currentPageContext.title;
                elements.pageUrl.textContent = currentPageContext.url;
                
                console.log('Page context loaded:', currentPageContext.title);
            } else {
                throw new Error('Failed to extract page content');
            }
        } else {
            // Try to find any browser window with tabs as fallback
            const allTabs = await browser.tabs.query({});
            const browserTabs = allTabs.filter(tab => 
                !tab.url.startsWith('moz-extension://') && 
                !tab.url.startsWith('chrome-extension://') &&
                !tab.url.startsWith('about:') &&
                tab.url.startsWith('http')
            );
            
            if (browserTabs.length > 0) {
                // Use the most recently accessed tab
                const tab = browserTabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
                
                const contentResponse = await browser.tabs.sendMessage(tab.id, { action: 'extractContent' });
                
                if (contentResponse && contentResponse.success) {
                    currentPageContext = {
                        title: contentResponse.data.title,
                        url: contentResponse.data.url,
                        content: contentResponse.data.textContent
                    };
                    
                    elements.pageTitle.textContent = currentPageContext.title;
                    elements.pageUrl.textContent = currentPageContext.url;
                    
                    console.log('Page context loaded from recent tab:', currentPageContext.title);
                } else {
                    throw new Error('Failed to extract content from any tab');
                }
            } else {
                throw new Error('No web pages found to analyze');
            }
        }
    } catch (error) {
        console.error('Error loading page context:', error);
        elements.pageTitle.textContent = 'Error loading page';
        elements.pageUrl.textContent = 'Content extraction failed';
        addMessage('error', 'Could not load page content. Please refresh the page and try again.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Send button
    elements.sendButton.addEventListener('click', handleSendMessage);
    
    // Export button
    elements.exportButton.addEventListener('click', handleExportChat);
    
    // Input handling
    elements.messageInput.addEventListener('input', handleInputChange);
    elements.messageInput.addEventListener('keydown', handleKeyDown);
    
    // Suggestion buttons
    elements.suggestionBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const message = e.target.dataset.message;
            if (message) {
                elements.messageInput.value = message;
                handleSendMessage();
            }
        });
    });
}

// Handle input changes
function handleInputChange() {
    const input = elements.messageInput;
    const hasText = input.value.trim().length > 0;
    
    // Enable/disable send button
    elements.sendButton.disabled = !hasText || isProcessing;
    
    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
}

// Handle keyboard input
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!elements.sendButton.disabled) {
            handleSendMessage();
        }
    }
}

// Handle sending message
async function handleSendMessage() {
    if (isProcessing || !elements.messageInput.value.trim()) return;
    
    const userMessage = elements.messageInput.value.trim();
    
    // Add user message to chat
    addMessage('user', userMessage);
    
    // Clear input
    elements.messageInput.value = '';
    handleInputChange();
    
    // Show typing indicator
    showTypingIndicator();
    
    try {
        // Get AI response
        const response = await callOllamaAPI(userMessage);
        
        // Remove typing indicator
        hideTypingIndicator();
        
        if (response.success) {
            // Add AI response to chat
            addMessage('ai', response.response);
            
            // Add to chat history
            chatHistory.push({
                user: userMessage,
                ai: response.response,
                timestamp: new Date().toISOString()
            });
            
            // Save to storage
            await saveChatHistory();
        } else {
            addMessage('error', response.error);
        }
    } catch (error) {
        hideTypingIndicator();
        addMessage('error', 'An unexpected error occurred. Please try again.');
        console.error('Error sending message:', error);
    }
}

// Call Ollama API
async function callOllamaAPI(userMessage) {
    // Create context-aware prompt
    const contextPrompt = createContextPrompt(userMessage);
    
    const requestBody = {
        model: OLLAMA_CONFIG.model,
        prompt: contextPrompt,
        stream: false,
        options: {
            temperature: 0.7,
            max_tokens: 128000
        }
    };

    try {
        const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(OLLAMA_CONFIG.timeout)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            response: data.response,
            model: data.model
        };

    } catch (error) {
        console.error('Error calling Ollama API:', error);
        
        let errorMessage = 'Failed to get response';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Could not connect to Ollama. Please ensure it is running with CORS enabled.';
        } else if (error.message.includes('HTTP error! status: 403')) {
            errorMessage = `Ollama server denied the request. Please restart Ollama with: $env:OLLAMA_ORIGINS='*'; ollama serve`;
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

// Create context-aware prompt
function createContextPrompt(userMessage) {
    let prompt = `You are an AI assistant helping to discuss and analyze web page content. Here's the context:\n\n`;
    
    // Add page context
    if (currentPageContext) {
        prompt += `Page Title: ${currentPageContext.title}\n`;
        prompt += `Page URL: ${currentPageContext.url}\n`;
        prompt += `Page Content: ${currentPageContext.content.substring(0, 3000)}...\n\n`;
    }
    
    // Add recent chat history for context
    if (chatHistory.length > 0) {
        prompt += `Previous conversation:\n`;
        const recentHistory = chatHistory.slice(-3); // Last 3 exchanges
        recentHistory.forEach(exchange => {
            prompt += `User: ${exchange.user}\n`;
            prompt += `Assistant: ${exchange.ai}\n\n`;
        });
    }
    
    prompt += `Current user question: ${userMessage}\n\n`;
    prompt += `Please provide a helpful, accurate, and conversational response based on the page content and context. If the question is not related to the page content, you can still provide a helpful general response.`;
    
    return prompt;
}

// Add message to chat
function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Add copy button for AI and user messages
    if (type === 'ai' || type === 'user') {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = () => copyToClipboard(content);
        messageContent.appendChild(copyButton);
    }
    
    // Format content
    if (type === 'error') {
        messageContent.innerHTML = `<p style="color: #dc3545;">${escapeHtml(content)}</p>`;
    } else {
        messageContent.innerHTML = formatMessageContent(content);
    }
    
    messageDiv.appendChild(messageContent);
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Format message content with markdown rendering
function formatMessageContent(content) {
    // First escape HTML to prevent XSS
    let html = escapeHtml(content);
    
    // Apply markdown formatting
    html = renderMarkdown(html);
    
    return html;
}

// Simple markdown renderer
function renderMarkdown(text) {
    // Convert code blocks first (to avoid conflicts with other patterns)
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Convert headers
    text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Convert bold text
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert italic text
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Convert links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Convert blockquotes
    text = text.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // Convert unordered lists
    text = text.replace(/^- (.*$)/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Convert ordered lists
    text = text.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
    
    // Convert line breaks (but preserve existing HTML)
    text = text.replace(/\n/g, '<br>');
    
    return text;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        console.log('Content copied to clipboard');
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

// Show typing indicator
function showTypingIndicator() {
    isProcessing = true;
    elements.sendButton.disabled = true;
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typingIndicator';
    
    typingDiv.innerHTML = `
        <span>AI is typing</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    
    elements.chatMessages.appendChild(typingDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    isProcessing = false;
    handleInputChange(); // Re-enable button if input has text
    
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Save chat history
async function saveChatHistory() {
    try {
        const storageKey = `chat_history_${Date.now()}`;
        await browser.storage.local.set({
            [storageKey]: {
                pageUrl: currentPageContext?.url || 'unknown',
                pageTitle: currentPageContext?.title || 'unknown',
                history: chatHistory,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error saving chat history:', error);
    }
}

// Export chat functionality
function handleExportChat() {
    console.log('Export chat clicked, chatHistory length:', chatHistory.length);
    
    if (chatHistory.length === 0) {
        alert('No chat messages to export. Start a conversation first!');
        return;
    }
    
    const exportData = generateMarkdownExport();
    showExportModal(exportData);
}

function generateMarkdownExport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pageTitle = elements.pageTitle.textContent || 'Unknown Page';
    const pageUrl = elements.pageUrl.textContent || 'Unknown URL';
    
    console.log('Generating markdown export for', chatHistory.length, 'chat exchanges');
    
    let markdown = `# AI Chat Export - ${pageTitle}\n\n`;
    markdown += `**Page URL:** ${pageUrl}\n`;
    markdown += `**Export Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Messages:** ${chatHistory.length}\n\n`;
    markdown += `---\n\n`;
    
    // Add chat messages
    chatHistory.forEach((exchange, index) => {
        // Export user message
        markdown += `## **You**\n\n`;
        markdown += `${exchange.user.replace(/\n/g, '\n\n')}\n\n`;
        markdown += `---\n\n`;
        
        // Export AI message  
        markdown += `## **AI Assistant**\n\n`;
        markdown += `${exchange.ai.replace(/\n/g, '\n\n')}\n\n`;
        
        if (index < chatHistory.length - 1) {
            markdown += `---\n\n`;
        }
    });
    
    console.log('Generated markdown export:', markdown.length, 'characters');
    return markdown;
}

function showExportModal(markdownContent) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
        <div class="export-modal-content">
            <div class="export-modal-header">
                <h3>Export Chat as Markdown</h3>
                <button class="export-modal-close">&times;</button>
            </div>
            <div class="export-modal-body">
                <div class="export-options">
                    <button id="copyMarkdown" class="export-option-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy to Clipboard
                    </button>
                    <button id="downloadMarkdown" class="export-option-btn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7,10 12,15 17,10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download File
                    </button>
                </div>
                <textarea class="export-preview" readonly>${markdownContent}</textarea>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event handlers
    const closeBtn = modal.querySelector('.export-modal-close');
    const copyBtn = modal.querySelector('#copyMarkdown');
    const downloadBtn = modal.querySelector('#downloadMarkdown');
    
    closeBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(markdownContent);
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                Copied!
            `;
            setTimeout(() => {
                copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    Copy to Clipboard
                `;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });
    
    downloadBtn.addEventListener('click', () => {
        const pageTitle = elements.pageTitle.textContent || 'chat';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const filename = `ai-chat-${pageTitle.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.md`;
        
        const blob = new Blob([markdownContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        document.body.removeChild(modal);
    });
}

// Initialize the sidebar
document.addEventListener('DOMContentLoaded', () => {
    init();
}); 