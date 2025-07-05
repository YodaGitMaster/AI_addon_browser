// AI Page Chat Sidebar Script
console.log('AI Page Chat sidebar loaded');

// Configuration
const OLLAMA_CONFIG = {
    baseUrl: 'http://localhost:11434',
    model: 'gemma3:4b',
    timeout: 120000 // Increase timeout to 2 minutes for image processing
};

// Global variables
let currentPageContext = null;
let chatHistory = [];
let isProcessing = false;

// State management functions
function clearPendingState() {
    window.pendingImages = [];
    console.log('Cleared pending state');
}

function initializePendingState() {
    if (!window.pendingImages) {
        window.pendingImages = [];
    }
}

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
    
    // Initialize clean state
    clearPendingState();
    
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
            
            // Get page content (without screenshots initially)
            const contentResponse = await browser.tabs.sendMessage(tab.id, { action: 'extractContent', includeScreenshots: false });
            
            if (contentResponse && contentResponse.success) {
                currentPageContext = {
                    title: contentResponse.data.title,
                    url: contentResponse.data.url,
                    content: contentResponse.data.textContent,
                    tables: contentResponse.data.tables || [],
                    charts: contentResponse.data.charts || []
                };
                
                // Update UI
                elements.pageTitle.textContent = currentPageContext.title;
                elements.pageUrl.textContent = currentPageContext.url;
                
                console.log('Page context loaded:', currentPageContext.title);
                console.log('Tables found:', currentPageContext.tables.length);
                console.log('Charts found:', currentPageContext.charts.length);
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
                
                const contentResponse = await browser.tabs.sendMessage(tab.id, { action: 'extractContent', includeScreenshots: false });
                
                if (contentResponse && contentResponse.success) {
                    currentPageContext = {
                        title: contentResponse.data.title,
                        url: contentResponse.data.url,
                        content: contentResponse.data.textContent,
                        tables: contentResponse.data.tables || [],
                        charts: contentResponse.data.charts || []
                    };
                    
                    elements.pageTitle.textContent = currentPageContext.title;
                    elements.pageUrl.textContent = currentPageContext.url;
                    
                    console.log('Page context loaded from recent tab:', currentPageContext.title);
                    console.log('Tables found:', currentPageContext.tables.length);
                    console.log('Charts found:', currentPageContext.charts.length);
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

// Handle send message
async function handleSendMessage() {
    const userMessage = elements.messageInput.value.trim();
    if (!userMessage || isProcessing) return;

    try {
        // Clear any previous pending state first
        clearPendingState();
        
        // Clear input first
        elements.messageInput.value = '';
        handleInputChange();

        // Get context and images before sending
        const { prompt, images } = await createContextPrompt(userMessage);
        const displayImages = images.map(img => `data:image/png;base64,${img}`);

        // Store images globally for removal functionality
        window.pendingImages = [...displayImages];

        // Show draft message with removable images
        const draftMessageDiv = addMessage('user', userMessage, window.pendingImages, true);
        
        // Add send confirmation buttons if there are images
        if (window.pendingImages.length > 0) {
            const confirmContainer = document.createElement('div');
            confirmContainer.style.cssText = `
                display: flex;
                gap: 8px;
                margin-top: 8px;
                justify-content: flex-end;
            `;
            
            const sendButton = document.createElement('button');
            sendButton.textContent = 'Send';
            sendButton.style.cssText = `
                background: #28a745; /* Green */
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;

            const manageButton = document.createElement('button');
            manageButton.textContent = 'Manage Images';
            manageButton.style.cssText = `
                background: #ffc107; /* Yellow */
                color: black;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            
            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.style.cssText = `
                background: #dc3545;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
            `;
            
            manageButton.onclick = () => {
                showImageManagerModal(draftMessageDiv);
            };

            sendButton.onclick = () => {
                // Now, Send always reads the current images from the draft message
                const currentImageElements = draftMessageDiv.querySelectorAll('.images-container img');
                const currentImages = Array.from(currentImageElements).map(img => img.src);
                
                console.log('Sending message with', currentImages.length, 'images.');

                draftMessageDiv.remove(); // Remove the entire draft message
                sendMessageWithImages(userMessage, currentImages);
            };
            
            cancelButton.onclick = () => {
                draftMessageDiv.remove();
                clearPendingState(); // Clear global state
                elements.messageInput.value = userMessage; // Restore message
                handleInputChange();
            };
            
            confirmContainer.appendChild(manageButton);
            confirmContainer.appendChild(sendButton);
            confirmContainer.appendChild(cancelButton);
            
            draftMessageDiv.querySelector('.message-content').appendChild(confirmContainer);
        } else {
            // No images, just send the message directly
            sendMessageWithImages(userMessage, []);
        }
        
    } catch (error) {
        addMessage('error', 'An unexpected error occurred. Please try again.');
        console.error('Error preparing message:', error);
    }
}

// Send message with specified images
async function sendMessageWithImages(userMessage, selectedImages) {
    console.log('=== SEND MESSAGE WITH IMAGES DEBUG ===');
    console.log('Function called with selectedImages length:', selectedImages.length);
    console.log('selectedImages preview:', selectedImages.map((img, i) => i + ': ' + img.substring(0, 30) + '...'));
    console.log('=== END SEND MESSAGE DEBUG ===');
    
    try {
        // Remove the draft message
        const draftMessages = document.querySelectorAll('.user-message');
        const lastDraft = draftMessages[draftMessages.length - 1];
        if (lastDraft && lastDraft.querySelector('button')) {
            lastDraft.remove();
        }
        
        // Clear pending state since we're now sending
        clearPendingState();
        
        // Add final user message
        addMessage('user', userMessage, selectedImages);
        
        // Show typing indicator
        showTypingIndicator();
        
        // Prepare images for API (remove data: prefix)
        const apiImages = selectedImages.map(img => img.split(',')[1]);
        
        // Call Ollama API with selected images
        const response = await callOllamaAPIWithImages(userMessage, apiImages);
        
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

// Call Ollama API with specific images
async function callOllamaAPIWithImages(userMessage, images) {
    // Create different prompts based on whether images are present
    let prompt;
    
    if (images.length > 0) {
        // Image-only context: Focus on trading analysis with commentary
        prompt = `You are a professional trading analyst. Analyze the charts/graphs in the provided images and provide:

1. **Chart Commentary**: Brief description of what you see in the chart (price action, patterns, key levels)
2. **Technical Analysis**: Explain the current trend, support/resistance levels, and any notable patterns or indicators
3. **Market Outlook**: Quick assessment of the overall direction (bullish/bearish/sideways)
4. **Recommendation**: Clear BUY or SELL recommendation with brief reasoning

Keep your response focused, informative, and actionable. Focus only on the visual data in the images.

User request: ${userMessage}`;
    } else {
        // No images: Use full context prompt
        prompt = createContextPromptTextOnly(userMessage);
    }
    
    console.log('Calling Ollama API with:', {
        promptType: images.length > 0 ? 'ENHANCED TRADING ANALYSIS' : 'FULL CONTEXT',
        promptLength: prompt.length,
        imagesCount: images.length,
        hasImages: images.length > 0,
        imagesSample: images.length > 0 ? images[0].substring(0, 50) + '...' : 'No images'
    });
    
    // Construct the messages array for the multimodal model using Ollama's format
    const message = {
        role: 'user',
        content: prompt
    };
    
    // Add images to the message if available (Ollama format)
    if (images.length > 0) {
        message.images = images;
        console.log('Added images to message:', images.length);
    }

    const requestBody = {
        model: OLLAMA_CONFIG.model,
        messages: [message],
        stream: false,
        options: {
            temperature: 0.7,
            max_tokens: 128000
        }
    };

    console.log('Request body structure:', {
        model: requestBody.model,
        messagesCount: requestBody.messages.length,
        hasImages: !!requestBody.messages[0].images,
        imagesCount: requestBody.messages[0].images ? requestBody.messages[0].images.length : 0
    });

    try {
        // Use /api/chat endpoint for multimodal support
        const response = await fetch(`${OLLAMA_CONFIG.baseUrl}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(OLLAMA_CONFIG.timeout)
        });

        console.log('API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API response received:', {
            hasContent: !!data.message?.content,
            contentLength: data.message?.content?.length || 0
        });
        
        return {
            success: true,
            response: data.message.content,
            model: data.model
        };

    } catch (error) {
        console.error('Error calling Ollama API:', error);
        
        let errorMessage = 'Failed to get response';
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Could not connect to Ollama. Please ensure it is running with CORS enabled.';
        } else if (error.message.includes('HTTP error! status: 403')) {
            errorMessage = `Ollama server denied the request. Please restart Ollama with: $env:OLLAMA_ORIGINS='*'; ollama serve`;
        } else if (error.message.includes('HTTP error! status: 400')) {
            errorMessage = 'Bad request to Ollama. Please ensure you are using a multimodal model like llava for image analysis.';
        }
        
        return {
            success: false,
            error: errorMessage
        };
    }
}

// Create context-aware prompt without images (text only)
function createContextPromptTextOnly(userMessage) {
    let prompt = `You are an AI assistant helping to discuss and analyze web page content. Here's the context:\n\n`;
    
    // Add page context
    if (currentPageContext) {
        prompt += `Page Title: ${currentPageContext.title}\n`;
        prompt += `Page URL: ${currentPageContext.url}\n`;
        prompt += `Page Content: ${currentPageContext.content.substring(0, 3000)}...\n\n`;
        
        // Add table information if available
        if (currentPageContext.tables && currentPageContext.tables.length > 0) {
            prompt += `Tables found on page (${currentPageContext.tables.length}):\n`;
            currentPageContext.tables.forEach((table, index) => {
                prompt += `Table ${table.id}: ${table.caption || 'No caption'}\n`;
                if (table.headers.length > 0) {
                    prompt += `  Headers: ${table.headers.join(', ')}\n`;
                }
                prompt += `  Rows: ${table.rows.length}\n`;
                
                // Include first few rows as sample data
                if (table.rows.length > 0) {
                    prompt += `  Sample data:\n`;
                    table.rows.slice(0, 3).forEach(row => {
                        prompt += `    ${row.join(' | ')}\n`;
                    });
                }
                prompt += '\n';
            });
        }
        
        // Add chart information if available
        if (currentPageContext.charts && currentPageContext.charts.length > 0) {
            prompt += `Charts/Graphs found on page (${currentPageContext.charts.length}):\n`;
            currentPageContext.charts.forEach((chart, index) => {
                prompt += `Chart ${chart.id} (${chart.type}): ${chart.description || 'No description'}\n`;
                if (chart.context) {
                    prompt += `  Context: ${chart.context}\n`;
                }
                if (chart.textContent) {
                    prompt += `  Content: ${chart.textContent.substring(0, 100)}...\n`;
                }
                prompt += '\n';
            });
        }
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
    prompt += `Please provide a helpful, accurate, and conversational response based on the page content and context. If analyzing tables, provide clear insights about the data. If analyzing charts, describe what the visual elements might represent. If the question is not related to the page content, you can still provide a helpful general response.`;
    
    return prompt;
}

// Create context-aware prompt (with images)
async function createContextPrompt(userMessage) {
    let prompt = `You are an AI assistant helping to discuss and analyze web page content. Here's the context:\n\n`;
    
    // Add page context
    if (currentPageContext) {
        prompt += `Page Title: ${currentPageContext.title}\n`;
        prompt += `Page URL: ${currentPageContext.url}\n`;
        prompt += `Page Content: ${currentPageContext.content.substring(0, 3000)}...\n\n`;
        
        // Add table information if available
        if (currentPageContext.tables && currentPageContext.tables.length > 0) {
            prompt += `Tables found on page (${currentPageContext.tables.length}):\n`;
            currentPageContext.tables.forEach((table, index) => {
                prompt += `Table ${table.id}: ${table.caption || 'No caption'}\n`;
                if (table.headers.length > 0) {
                    prompt += `  Headers: ${table.headers.join(', ')}\n`;
                }
                prompt += `  Rows: ${table.rows.length}\n`;
                
                // Include first few rows as sample data
                if (table.rows.length > 0) {
                    prompt += `  Sample data:\n`;
                    table.rows.slice(0, 3).forEach(row => {
                        prompt += `    ${row.join(' | ')}\n`;
                    });
                }
                prompt += '\n';
            });
        }
        
        // Add chart information if available
        if (currentPageContext.charts && currentPageContext.charts.length > 0) {
            prompt += `Charts/Graphs found on page (${currentPageContext.charts.length}):\n`;
            currentPageContext.charts.forEach((chart, index) => {
                prompt += `Chart ${chart.id} (${chart.type}): ${chart.description || 'No description'}\n`;
                if (chart.context) {
                    prompt += `  Context: ${chart.context}\n`;
                }
                if (chart.textContent) {
                    prompt += `  Content: ${chart.textContent.substring(0, 100)}...\n`;
                }
                prompt += '\n';
            });
        }
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
    prompt += `Please provide a helpful, accurate, and conversational response based on the page content and context. If analyzing tables, provide clear insights about the data. If analyzing charts, describe what the visual elements might represent. If the question is not related to the page content, you can still provide a helpful general response.`;
    
    // Check if user message indicates they want visual analysis
    const visualAnalysisKeywords = ['chart', 'graph', 'analyze', 'screenshot', 'visual', 'image', 'plot', 'diagram', 'see', 'show', 'look'];
    const needsVisualAnalysis = visualAnalysisKeywords.some(keyword => 
        userMessage.toLowerCase().includes(keyword)
    );
    
    const matchedKeywords = visualAnalysisKeywords.filter(keyword => userMessage.toLowerCase().includes(keyword));
    console.log('User message analysis:', {
        message: userMessage,
        needsVisualAnalysis: needsVisualAnalysis,
        matchedKeywords: matchedKeywords
    });
    
    // Extract all chart screenshots into an array (only if needed)
    const images = [];

    
    if (needsVisualAnalysis && currentPageContext && currentPageContext.charts && currentPageContext.charts.length > 0) {
        console.log('Visual analysis requested - checking for existing screenshots');
        
        // Check if we already have screenshots
        const hasScreenshots = currentPageContext.charts.some(chart => chart.screenshot);
        
        if (!hasScreenshots) {
            console.log('No screenshots available - capturing now');
            // Capture screenshots on demand
            try {
                const tabs = await browser.tabs.query({ active: true });
                const webTabs = tabs.filter(tab => 
                    !tab.url.startsWith('moz-extension://') && 
                    !tab.url.startsWith('chrome-extension://') &&
                    !tab.url.startsWith('about:') &&
                    tab.url.startsWith('http')
                );
                
                if (webTabs.length > 0) {
                    const contentResponse = await browser.tabs.sendMessage(webTabs[0].id, { 
                        action: 'extractContent', 
                        includeScreenshots: true 
                    });
                    
                    if (contentResponse && contentResponse.success) {
                        // Update current context with screenshots
                        currentPageContext.charts = contentResponse.data.charts || [];
                        console.log('Screenshots captured on demand:', currentPageContext.charts.filter(c => c.screenshot).length);
                    }
                }
            } catch (error) {
                console.error('Error capturing screenshots on demand:', error);
            }
        }
        
        // Now extract images from charts
        currentPageContext.charts.forEach(chart => {
            console.log(`Chart ${chart.id} (${chart.type}):`, {
                hasScreenshot: !!chart.screenshot,
                screenshotLength: chart.screenshot ? chart.screenshot.length : 0
            });
            if (chart.screenshot) {
                // Handle both full page screenshots and canvas screenshots
                if (chart.type === 'fullpage') {
                    // Full page screenshots already have the data: prefix
                    images.push(chart.screenshot.split(',')[1]); // Extract base64 part
                } else if (chart.type === 'canvas') {
                    // Canvas screenshots have the data: prefix
                    images.push(chart.screenshot.split(',')[1]); // Extract base64 part
                }
            }
        });
    }
    
    console.log('Final images array length:', images.length);
    return { prompt, images };
}

// Add message to chat
function addMessage(type, content, images = [], isEditable = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    // Add copy button for AI and user messages (but not drafts)
    if ((type === 'ai' || type === 'user') && !isEditable) {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.textContent = 'Copy';
        copyButton.onclick = () => copyToClipboard(content);
        messageContent.appendChild(copyButton);
    }
    
    // Add screenshot previews if images are provided
    if (images && images.length > 0) {
        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'images-container';
        imagesContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
            padding: 8px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 8px;
        `;
        
        images.forEach((imageData, index) => {
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'image-wrapper';
            imageWrapper.style.cssText = `
                position: relative;
                display: inline-block;
            `;
            imageWrapper.dataset.imageIndex = index; // Store the original index
            
            const imagePreview = document.createElement('img');
            imagePreview.src = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
            imagePreview.style.cssText = `
                max-width: 150px;
                max-height: 100px;
                border-radius: 4px;
                border: 1px solid #ddd;
                cursor: pointer;
                transition: transform 0.2s;
            `;
            imagePreview.title = 'Click to view full size';
            
            // Add hover effect
            imagePreview.onmouseover = () => imagePreview.style.transform = 'scale(1.05)';
            imagePreview.onmouseout = () => imagePreview.style.transform = 'scale(1)';
            
            // Add click to view full size
            imagePreview.onclick = () => {
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                    cursor: pointer;
                `;
                
                const fullImage = document.createElement('img');
                fullImage.src = imagePreview.src;
                fullImage.style.cssText = `
                    max-width: 90%;
                    max-height: 90%;
                    border-radius: 8px;
                `;
                
                modal.appendChild(fullImage);
                modal.onclick = () => document.body.removeChild(modal);
                document.body.appendChild(modal);
            };
            
            imageWrapper.appendChild(imagePreview);
            
            // The 'x' button logic has been removed from here.
            // Removal is now handled in the image manager modal.
            
            imagesContainer.appendChild(imageWrapper);
        });
        
        messageContent.appendChild(imagesContainer);
    }
    
    // Format content
    if (type === 'error') {
        messageContent.innerHTML += `<p style="color: #dc3545;">${escapeHtml(content)}</p>`;
    } else {
        messageContent.innerHTML += formatMessageContent(content);
    }
    
    messageDiv.appendChild(messageContent);
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    return messageDiv; // Return the message div for potential removal
}

// Show a modal for managing and removing images
function showImageManagerModal(draftMessageDiv) {
    // Modal container
    const modal = document.createElement('div');
    modal.id = 'imageManagerModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 20000;
    `;

    // Modal content
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 8px;
        max-width: 90%;
        max-height: 80%;
        overflow-y: auto;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Manage Images';
    title.style.marginTop = '0';
    modalContent.appendChild(title);

    // Image grid
    const imageGrid = document.createElement('div');
    imageGrid.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        margin-top: 15px;
    `;
    modalContent.appendChild(imageGrid);
    
    // Get current images from the draft message
    const imageElements = draftMessageDiv.querySelectorAll('.images-container .image-wrapper');
    
    imageElements.forEach(wrapper => {
        const itemContainer = document.createElement('div');
        itemContainer.style.textAlign = 'center';

        const img = wrapper.querySelector('img').cloneNode(true);
        img.style.maxWidth = '200px';
        img.style.maxHeight = '150px';
        itemContainer.appendChild(img);
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.style.cssText = `
            display: block;
            margin: 8px auto 0;
            background: #ff4444;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 4px;
            cursor: pointer;
        `;
        
        removeBtn.onclick = () => {
            // Remove from modal
            itemContainer.remove();
            // Remove the original from the draft message in the background
            wrapper.remove();
        };
        
        itemContainer.appendChild(removeBtn);
        imageGrid.appendChild(itemContainer);
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done';
    closeBtn.style.cssText = `
        display: block;
        margin: 20px auto 0;
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    closeBtn.onclick = () => document.body.removeChild(modal);
    modalContent.appendChild(closeBtn);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
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

// Handle messages from background script (context menu actions)
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'contextMenuAction') {
        console.log('Context menu action received:', message.menuItemId);
        
        // Generate appropriate prompt based on context menu selection
        let prompt = '';
        
        switch (message.menuItemId) {
            case 'ai-chat':
                prompt = message.selectedText ? 
                    `Please explain this selected text: "${message.selectedText}"` :
                    'Help me understand this page';
                break;
                
            case 'fact-check':
                prompt = message.selectedText ? 
                    `Please fact-check this statement: "${message.selectedText}"` :
                    'Please fact-check the main claims on this page';
                break;
                
            case 'extract-tables':
                prompt = 'Please extract and analyze all tables on this page. Format them clearly and explain what they show.';
                break;
                
            case 'financial-analysis':
                prompt = message.selectedText ? 
                    `Please provide a quick financial analysis of this data: "${message.selectedText}"` :
                    'Please provide a quick financial analysis of this page content';
                break;
                
            case 'chart-analysis':
                prompt = message.selectedText ? 
                    `Please analyze this chart/graph data: "${message.selectedText}"` :
                    'Please analyze any charts, graphs, or visual data on this page';
                break;
                
            case 'summarize-page':
                prompt = 'Please summarize this page.';
                break;

            case 'quick-summary':
                prompt = message.selectedText ? 
                    `Please provide a quick summary of this selected text: "${message.selectedText}"` :
                    'Please provide a quick summary of this page.';
                break;

            case 'main-points':
                prompt = message.selectedText ? 
                    `What are the main points of this selected text in bullet points: "${message.selectedText}"` :
                    'What are the main points of this page in bullet points?';
                break;

            case 'explain-further':
                prompt = message.selectedText ? 
                    `Please explain this topic further and provide background information based on: "${message.selectedText}"` :
                    'Please explain this topic further, and give me background information based on the page content.';
                break;

            case 'ask-questions':
                prompt = message.selectedText ? 
                    `What questions should I ask about this selected text: "${message.selectedText}"` :
                    'What questions should I ask about this page content?';
                break;
                
            case 'study-questions':
                prompt = message.selectedText ? 
                    `Please generate study questions and flashcards based on this selected text: "${message.selectedText}"` :
                    'Please generate study questions and flashcards based on this page content';
                break;
        }
        
        // Set the prompt in the input field and send it
        if (prompt) {
            elements.messageInput.value = prompt;
            handleInputChange(); // Update send button state
            
            // Auto-send the message after a short delay
            setTimeout(() => {
                handleSendMessage();
            }, 500);
        }
    }
});

// Note: Sidebar initialization is already handled by the existing DOMContentLoaded listener above 