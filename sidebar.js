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
const MAX_TOKEN_LIMIT = 128000; // Gemma3 4B model has a 128k token context window
const TOKEN_ESTIMATION_FACTOR = 1.3; // Rough estimate: 1 word ~ 1.3 tokens
let currentImages = []; // Array to store currently selected image dataURLs and their original URLs
let currentContext = { content: '', images: [] }; // Object to store the current page context
let draftMessage = null; // To store the draft message when images are being analyzed
let selectedTabsData = []; // Store content and metadata of selected tabs for multi-tab context

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
    editContextButton: document.getElementById('editContextButton'),
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
                    charts: contentResponse.data.charts || [],
                    images: contentResponse.data.images || []
                };
                
                // Update UI
                elements.pageTitle.textContent = currentPageContext.title;
                elements.pageUrl.textContent = currentPageContext.url;
                
                console.log('Page context loaded:', currentPageContext.title);
                console.log('Tables found:', currentPageContext.tables.length);
                console.log('Charts found:', currentPageContext.charts.length);
                console.log('Images found:', currentPageContext.images.length);
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
                        charts: contentResponse.data.charts || [],
                        images: contentResponse.data.images || []
                    };
                    
                    elements.pageTitle.textContent = currentPageContext.title;
                    elements.pageUrl.textContent = currentPageContext.url;
                    
                    console.log('Page context loaded from recent tab:', currentPageContext.title);
                    console.log('Tables found:', currentPageContext.tables.length);
                    console.log('Charts found:', currentPageContext.charts.length);
                    console.log('Images found:', currentPageContext.images.length);
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
    
    // Edit context button
    elements.editContextButton.addEventListener('click', handleEditContext);
    
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
    
    isProcessing = true;

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

        // Only show draft message if there are images that need management
        let draftMessageDiv = null;
        if (window.pendingImages.length > 0) {
            // Start with no images selected - user must explicitly choose
            draftMessageDiv = addMessage('user', userMessage, [], true);
            
            // Ensure there's an images container for selections to be displayed
            if (!draftMessageDiv.querySelector('.images-container')) {
                const imagesContainer = document.createElement('div');
                imagesContainer.className = 'images-container';
                imagesContainer.style.cssText = `
                    display: none;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 12px;
                    padding: 8px;
                    background: rgba(0, 0, 0, 0.05);
                    border-radius: 8px;
                `;
                
                const messageContent = draftMessageDiv.querySelector('.message-content');
                messageContent.insertBefore(imagesContainer, messageContent.firstChild);
            }
        }
        
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
            manageButton.textContent = 'Select Images';
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
                
                // Get the page text context option from the draft message
                const includePageText = draftMessageDiv.dataset.includePageText === 'true';
                
                console.log('Sending message with', currentImages.length, 'images and page text context:', includePageText);

                draftMessageDiv.remove(); // Remove the entire draft message
                sendMessageWithImages(userMessage, currentImages, includePageText);
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
            sendMessageWithImages(userMessage, [], false);
        }
        
    } catch (error) {
        addMessage('error', 'An unexpected error occurred. Please try again.');
        console.error('Error preparing message:', error);
    } finally {
        isProcessing = false;
    }
}

// Send message with specified images
async function sendMessageWithImages(userMessage, selectedImages, includePageText = false) {
    
    try {
        // Remove the draft message (only exists if there were images)
        const draftMessages = document.querySelectorAll('.user-message');
        const lastDraft = draftMessages[draftMessages.length - 1];
        if (lastDraft && (lastDraft.querySelector('button') || lastDraft.querySelector('.images-container'))) {
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
        const response = await callOllamaAPIWithImages(userMessage, apiImages, includePageText);
        
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
async function callOllamaAPIWithImages(userMessage, images, includePageText = false) {
    // Create different prompts based on whether images are present
    let prompt;
    
    if (images.length > 0) {
        // Images provided - create context-aware prompt
        if (includePageText) {
            // Include page context for better image understanding
            prompt = `You are an AI assistant analyzing images with page context. 

**Page Context:**
`;
            
            // Add page context information
            if (currentPageContext) {
                prompt += `Page Title: ${currentPageContext.title}\n`;
                prompt += `Page URL: ${currentPageContext.url}\n`;
                prompt += `Page Content: ${currentPageContext.content.substring(0, 2000)}...\n\n`;
            }
            
            prompt += `**Image Analysis Task:**
Analyze the provided images and provide:
1. **Short description** of what each image shows
2. **Key visual elements**, colors, and composition
3. **Any text or data** visible in the images
4. **Context and relevance** to the page content above
5. **Notable details or insights** that might be useful

**User Question:** ${userMessage}

Please provide a comprehensive analysis using both the visual content and the page context.`;
        } else {
            // Images only - focused analysis without page context
            prompt = `You are an AI assistant analyzing images. 

**Image Analysis Task:**
Analyze the provided images and provide:
1. **Short description** of what each image shows
2. **Key visual elements**, colors, and composition  
3. **Any text or data** visible in the images
4. **Notable details or insights** that might be useful

**User Question:** ${userMessage}

Please provide a comprehensive analysis focusing on the visual content.`;
        }
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
                prompt += `- Chart ${index + 1}: ${chart.type} (${chart.width}x${chart.height}) - ${chart.description}\n`;
            });
            prompt += '\n';
        }

        if (currentPageContext.images && currentPageContext.images.length > 0) {
            prompt += `Content Images found on page (${currentPageContext.images.length}):\n`;
            currentPageContext.images.forEach((image, index) => {
                prompt += `- Image ${index + 1}: ${image.description} (${image.width}x${image.height}) - ${image.alt}\n`;
            });
            prompt += '\n';
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
                prompt += `- Chart ${index + 1}: ${chart.type} (${chart.width}x${chart.height}) - ${chart.description}\n`;
            });
            prompt += '\n';
        }

        if (currentPageContext.images && currentPageContext.images.length > 0) {
            prompt += `Content Images found on page (${currentPageContext.images.length}):\n`;
            currentPageContext.images.forEach((image, index) => {
                prompt += `- Image ${index + 1}: ${image.description} (${image.width}x${image.height}) - ${image.alt}\n`;
            });
            prompt += '\n';
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
    
    // Always extract images when they exist on the page - let users choose via selection modal
    console.log('Checking for available images on page');
    
    // Extract all chart screenshots into an array
    const images = [];
    const imageHashes = new Set(); // Track image hashes to prevent duplicates
    
    // Helper function to create a simple hash from image data
    function simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }
    
    // Helper function to add image with deduplication
    function addUniqueImage(imageData, source) {
        if (!imageData) return;
        
        // Create hash from first 1000 characters of base64 data for performance
        const hashData = imageData.substring(0, 1000);
        const hash = simpleHash(hashData);
        
        if (!imageHashes.has(hash)) {
            imageHashes.add(hash);
            images.push(imageData);
            console.log(`Added unique image from ${source}, hash: ${hash}`);
        } else {
            console.log(`Skipped duplicate image from ${source}, hash: ${hash}`);
        }
    }
    
    // Always check for charts and images if they exist on the page
    if (currentPageContext && (currentPageContext.charts?.length > 0 || currentPageContext.images?.length > 0)) {
        console.log('Images/charts found on page - checking for screenshots');
        
        // Check if we already have screenshots for charts
        const hasChartScreenshots = currentPageContext.charts?.some(chart => chart.screenshot) || false;
        const hasImageScreenshots = currentPageContext.images?.some(image => image.screenshot) || false;
        
        if (!hasChartScreenshots || !hasImageScreenshots) {
            console.log('Missing screenshots - capturing now');
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
                        currentPageContext.images = contentResponse.data.images || [];
                        console.log('Screenshots captured - Charts:', currentPageContext.charts.filter(c => c.screenshot).length, 'Images:', currentPageContext.images.filter(i => i.screenshot).length);
                    }
                }
            } catch (error) {
                console.error('Error capturing screenshots on demand:', error);
            }
        }
        
        // Extract images from charts
        if (currentPageContext.charts) {
            currentPageContext.charts.forEach(chart => {
                console.log(`Chart ${chart.id} (${chart.type}):`, {
                    hasScreenshot: !!chart.screenshot,
                    screenshotLength: chart.screenshot ? chart.screenshot.length : 0
                });
                if (chart.screenshot) {
                    // Handle both full page screenshots and canvas screenshots
                    if (chart.type === 'fullpage') {
                        // Full page screenshots already have the data: prefix
                        const imageData = chart.screenshot.split(',')[1]; // Extract base64 part
                        addUniqueImage(imageData, `chart-${chart.id}-fullpage`);
                    } else if (chart.type === 'canvas') {
                        // Canvas screenshots have the data: prefix
                        const imageData = chart.screenshot.split(',')[1]; // Extract base64 part
                        addUniqueImage(imageData, `chart-${chart.id}-canvas`);
                    }
                }
            });
        }

        // Extract images from detected content images
        if (currentPageContext.images) {
            currentPageContext.images.forEach(image => {
                console.log(`Image ${image.id} (${image.type}):`, {
                    hasScreenshot: !!image.screenshot,
                    screenshotLength: image.screenshot ? image.screenshot.length : 0
                });
                if (image.screenshot) {
                    // Content images have the data: prefix
                    const imageData = image.screenshot.split(',')[1]; // Extract base64 part
                    addUniqueImage(imageData, `image-${image.id}-${image.type}`);
                }
            });
        }
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
    
    // Format content and append as DOM elements
    if (type === 'error') {
        const errorParagraph = document.createElement('p');
        errorParagraph.style.color = '#dc3545';
        errorParagraph.textContent = content; // textContent automatically escapes HTML
        messageContent.appendChild(errorParagraph);
    } else {
        // formatMessageContent will now return a DocumentFragment or an element
        const formattedContent = formatMessageContent(content);
        messageContent.appendChild(formattedContent);
    }
    
    messageDiv.appendChild(messageContent);
    elements.chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    
    return messageDiv; // Return the message div for potential removal
}

// Format message content with markdown rendering, now returning DOM elements
function formatMessageContent(content) {
    // The renderMarkdown function will now return a DocumentFragment or a DOM element
    return renderMarkdown(content);
}

// Enhanced markdown renderer with direct DOM manipulation
function renderMarkdown(text) {
    const fragment = document.createDocumentFragment();
    const lines = text.split('\n');
    let inCodeBlock = false;
    let inList = false;
    let listType = ''; // 'ul' or 'ol'
    let currentList = null;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let trimmedLine = line.trim();

        // Code Block Toggle
        if (trimmedLine.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            if (inCodeBlock) {
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.className = trimmedLine.substring(3).trim(); // Language hint
                pre.appendChild(code);
                fragment.appendChild(pre);
            } else {
                // End of code block, next line will be handled as normal
            }
            continue; // Skip processing this line further
        }

        if (inCodeBlock) {
            const lastPre = fragment.lastChild;
            if (lastPre && lastPre.tagName === 'PRE') {
                const code = lastPre.lastChild;
                if (code && code.tagName === 'CODE') {
                    code.textContent += line + '\n'; // Add line to code block, preserve newlines
                }
            }
            continue;
        }

        // Check for tables
        const tableResult = parseMarkdownTable(lines, i);
        if (tableResult.htmlElement) {
            if (inList) { // Close previous list if any
                inList = false;
                currentList = null;
            }
            fragment.appendChild(tableResult.htmlElement);
            i = tableResult.nextIndex - 1; // Adjust index to continue after table
            continue;
        }

        // Check for lists
        const isUl = trimmedLine.startsWith('-');
        const isOl = /^[0-9]+\./.test(trimmedLine);

        if (isUl || isOl) {
            if (!inList || (isUl && listType !== 'ul') || (isOl && listType !== 'ol')) {
                // Start a new list or switch list type
                if (currentList) {
                    fragment.appendChild(currentList);
                }
                listType = isUl ? 'ul' : 'ol';
                currentList = document.createElement(listType);
                fragment.appendChild(currentList); // Append the list container now
                inList = true;
            }

            const li = document.createElement('li');
            li.textContent = trimmedLine.substring(trimmedLine.indexOf(' ') + 1);
            currentList.appendChild(li);

        } else { // Not a list item
            if (inList) { // Close previous list
                inList = false;
                currentList = null;
            }

            // Headers
            if (trimmedLine.startsWith('### ')) {
                const h3 = document.createElement('h3');
                h3.textContent = trimmedLine.substring(4);
                fragment.appendChild(h3);
            } else if (trimmedLine.startsWith('## ')) {
                const h2 = document.createElement('h2');
                h2.textContent = trimmedLine.substring(3);
                fragment.appendChild(h2);
            } else if (trimmedLine.startsWith('# ')) {
                const h1 = document.createElement('h1');
                h1.textContent = trimmedLine.substring(2);
                fragment.appendChild(h1);
            } else if (trimmedLine.startsWith('> ')) {
                const blockquote = document.createElement('blockquote');
                blockquote.textContent = trimmedLine.substring(2);
                fragment.appendChild(blockquote);
            } else if (trimmedLine.length > 0) {
                // Default to paragraph for remaining content
                const p = document.createElement('p');
                // Apply inline markdown for the paragraph content
                p.appendChild(parseInlineMarkdown(line));
                fragment.appendChild(p);
            } else if (line.length === 0) {
                // Preserve empty lines as <br> or just skip
                // For simplicity, we can add a <br> for visual spacing or just let the paragraph flow handle it.
                // For now, let's just add an empty paragraph if there's a significant break
                if (lines[i-1] && lines[i-1].trim() !== '') {
                     fragment.appendChild(document.createElement('br'));
                }
            }
        }
    }

    // Append any unclosed list
    if (currentList) {
        fragment.appendChild(currentList);
    }
    
    return fragment;
}

// Helper to parse inline markdown (bold, italic, links, inline code)
function parseInlineMarkdown(text) {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    // Regex for: inline code (`...`), bold (**...**), links ([...](...))
    const regex = /(`[^`]+`)|(\*{2}[^*]+\*{2})|\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        // Add text before the current match
        if (match.index > lastIndex) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
        }

        if (match[1]) { // Inline code
            const code = document.createElement('code');
            code.textContent = match[1].substring(1, match[1].length - 1);
            fragment.appendChild(code);
        } else if (match[2]) { // Bold
            const strong = document.createElement('strong');
            strong.textContent = match[2].substring(2, match[2].length - 2);
            fragment.appendChild(strong);
        } else if (match[3] && match[4]) { // Link
            const a = document.createElement('a');
            a.href = match[4];
            a.textContent = match[3];
            a.target = '_blank'; // Open links in new tab
            fragment.appendChild(a);
        }
        lastIndex = regex.lastIndex;
    }

    // Add any remaining text after the last match
    if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }
    return fragment;
}

// Add some basic styling for tables
const style = document.createElement('style');
style.textContent = `
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 14px;
    border: 1px solid #ccc;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 8px;
    text-align: left;
  }
  th {
    background-color: #f2f2f2;
    font-weight: bold;
  }
  tbody tr:nth-child(even) {
    background-color: #f9f9f9;
  }
`;
document.head.appendChild(style);

// Convert markdown tables to HTML DOM elements
function parseMarkdownTable(lines, startIndex) {
    const tableLines = [];
    let i = startIndex;

    console.log('parseMarkdownTable called at line', startIndex, 'content:', lines[startIndex]);

    // First line must contain a pipe to be considered a table header
    if (!lines[i] || !lines[i].includes('|')) {
        console.log('No pipe found in first line, returning null');
        return { htmlElement: null, nextIndex: startIndex };
    }

    // Second line must be a valid separator - very flexible regex
    if (!lines[i + 1] || !lines[i + 1].match(/^[ |:-]+$/)) {
        console.log('Second line does not match separator pattern:', lines[i + 1]);
        return { htmlElement: null, nextIndex: startIndex };
    }

    console.log('Table detected! Processing...');

    // Collect all subsequent lines that are part of the table
    while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
    }

    if (tableLines.length < 2) {
        console.log('Not enough table lines:', tableLines.length);
        return { htmlElement: null, nextIndex: startIndex };
    }

    console.log('Creating table with', tableLines.length, 'lines');

    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    // Helper to parse a table row string
    const parseRow = (rowString) => {
        // Trim leading/trailing whitespace and pipes, then split
        return rowString.replace(/^ *\||\| *$/g, '').split('|').map(cell => cell.trim());
    };

    // Parse header
    const headerCells = parseRow(tableLines[0]);
    const headerRow = document.createElement('tr');
    headerCells.forEach(cellText => {
        const th = document.createElement('th');
        th.textContent = cellText;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const columnCount = headerCells.length;

    // Parse data rows (start from index 2, after header and separator)
    for (let j = 2; j < tableLines.length; j++) {
        const dataCells = parseRow(tableLines[j]);
        const dataRow = document.createElement('tr');
        
        // Ensure row has the same number of cells as the header
        for (let k = 0; k < columnCount; k++) {
            const td = document.createElement('td');
            td.textContent = dataCells[k] || ''; // Use empty string for missing cells
            dataRow.appendChild(td);
        }
        tbody.appendChild(dataRow);
    }

    table.appendChild(tbody);

    console.log('Table created successfully');
    return { htmlElement: table, nextIndex: i };
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
    title.textContent = 'Select Images to Include';
    title.style.marginTop = '0';
    modalContent.appendChild(title);

    // Instructions
    const instructions = document.createElement('p');
    instructions.textContent = 'Check the images you want to include in your message:';
    instructions.style.cssText = `
        margin-bottom: 15px;
        color: #666;
        font-size: 14px;
    `;
    modalContent.appendChild(instructions);

    // Page text context option
    const contextOption = document.createElement('div');
    contextOption.style.cssText = `
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 15px;
    `;

    const contextCheckbox = document.createElement('input');
    contextCheckbox.type = 'checkbox';
    contextCheckbox.id = 'includePageText';
    contextCheckbox.checked = true; // Default to checked
    contextCheckbox.style.cssText = `
        margin-right: 8px;
        transform: scale(1.1);
    `;

    const contextLabel = document.createElement('label');
    contextLabel.htmlFor = 'includePageText';
    contextLabel.textContent = '📄 Include page text content as context for image analysis';
    contextLabel.style.cssText = `
        font-weight: 500;
        color: #495057;
        cursor: pointer;
        display: flex;
        align-items: center;
    `;

    const contextDescription = document.createElement('p');
    contextDescription.textContent = 'This helps the AI understand the images better by providing the surrounding page content.';
    contextDescription.style.cssText = `
        margin: 8px 0 0 24px;
        font-size: 12px;
        color: #6c757d;
        line-height: 1.4;
    `;

    contextLabel.insertBefore(contextCheckbox, contextLabel.firstChild);
    contextOption.appendChild(contextLabel);
    contextOption.appendChild(contextDescription);
    modalContent.appendChild(contextOption);

    // Image grid
    const imageGrid = document.createElement('div');
    imageGrid.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
        margin-top: 15px;
    `;
    modalContent.appendChild(imageGrid);
    
    // Get all available images from window.pendingImages
    const allImages = window.pendingImages || [];
    
    allImages.forEach((imageData, index) => {
        const itemContainer = document.createElement('div');
        itemContainer.style.cssText = `
            text-align: center;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            transition: border-color 0.2s;
        `;

        // Checkbox for selection
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `image-${index}`;
        checkbox.style.cssText = `
            margin-bottom: 8px;
            transform: scale(1.2);
        `;
        
        // Label for checkbox
        const label = document.createElement('label');
        label.htmlFor = `image-${index}`;
        label.textContent = `Image ${index + 1}`;
        label.style.cssText = `
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            cursor: pointer;
        `;

        // Image preview
        const img = document.createElement('img');
        img.src = imageData;
        img.style.cssText = `
            max-width: 200px;
            max-height: 150px;
            border-radius: 4px;
            cursor: pointer;
            transition: transform 0.2s;
        `;
        
        // Click image to toggle checkbox
        img.onclick = () => {
            checkbox.checked = !checkbox.checked;
            updateContainerStyle();
        };
        
        // Update container style based on selection
        const updateContainerStyle = () => {
            if (checkbox.checked) {
                itemContainer.style.borderColor = '#28a745';
                itemContainer.style.backgroundColor = '#f8fff9';
            } else {
                itemContainer.style.borderColor = '#ddd';
                itemContainer.style.backgroundColor = 'white';
            }
        };
        
        checkbox.onchange = updateContainerStyle;
        
        itemContainer.appendChild(checkbox);
        itemContainer.appendChild(label);
        itemContainer.appendChild(img);
        imageGrid.appendChild(itemContainer);
    });

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: center;
        margin-top: 20px;
    `;

    // Select All button
    const selectAllBtn = document.createElement('button');
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    selectAllBtn.onclick = () => {
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = true;
            cb.onchange();
        });
    };

    // Clear All button
    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = 'Clear All';
    clearAllBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    clearAllBtn.onclick = () => {
        const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = false;
            cb.onchange();
        });
    };

    // Apply Selection button
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Selection';
    applyBtn.style.cssText = `
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    applyBtn.onclick = () => {
        // Get selected images
        const selectedImages = [];
        const imageCheckboxes = modal.querySelectorAll('input[type="checkbox"]:not(#includePageText)');
        imageCheckboxes.forEach((cb, index) => {
            if (cb.checked) {
                selectedImages.push(allImages[index]);
            }
        });
        
        // Get page text context option
        const includePageText = modal.querySelector('#includePageText').checked;
        
        // Store the page text option in the draft message for later use
        draftMessageDiv.dataset.includePageText = includePageText;
        
        // Update the draft message to show only selected images
        updateDraftMessageImages(draftMessageDiv, selectedImages);
        
        // Update the draft message to show page text context status
        updateDraftMessageContext(draftMessageDiv, includePageText);
        
        // Close modal
        document.body.removeChild(modal);
    };

    buttonContainer.appendChild(selectAllBtn);
    buttonContainer.appendChild(clearAllBtn);
    buttonContainer.appendChild(applyBtn);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// Helper function to update draft message with page text context status
function updateDraftMessageContext(draftMessageDiv, includePageText) {
    // Find or create context status indicator
    let contextIndicator = draftMessageDiv.querySelector('.context-indicator');
    
    if (!contextIndicator) {
        contextIndicator = document.createElement('div');
        contextIndicator.className = 'context-indicator';
        contextIndicator.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 8px;
            padding: 4px 8px;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 3px solid #007bff;
        `;
        
        // Insert at the top of message content
        const messageContent = draftMessageDiv.querySelector('.message-content');
        messageContent.insertBefore(contextIndicator, messageContent.firstChild);
    }
    
    if (includePageText) {
        contextIndicator.textContent = '📄 Page text context included for better image analysis';
        contextIndicator.style.display = 'block';
    } else {
        contextIndicator.textContent = '🖼️ Image-only analysis (no page context)';
        contextIndicator.style.display = 'block';
    }
}

// Helper function to update draft message with selected images
function updateDraftMessageImages(draftMessageDiv, selectedImages) {
    // Find the images container in the draft message
    const imagesContainer = draftMessageDiv.querySelector('.images-container');
    
    if (imagesContainer) {
        // Clear existing images
        imagesContainer.innerHTML = '';
        
        // Add selected images
        selectedImages.forEach((imageData, index) => {
            const imageWrapper = document.createElement('div');
            imageWrapper.className = 'image-wrapper';
            imageWrapper.style.cssText = `
                position: relative;
                display: inline-block;
            `;
            
            const imagePreview = document.createElement('img');
            imagePreview.src = imageData;
            imagePreview.style.cssText = `
                max-width: 150px;
                max-height: 100px;
                border-radius: 4px;
                border: 1px solid #ddd;
                cursor: pointer;
                transition: transform 0.2s;
            `;
            
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
            imagesContainer.appendChild(imageWrapper);
        });
        
        // Hide images container if no images selected
        if (selectedImages.length === 0) {
            imagesContainer.style.display = 'none';
        } else {
            imagesContainer.style.display = 'flex';
        }
    }
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

// Handle edit context
async function handleEditContext() {
    try {
        // Get all valid browser tabs
        const allTabs = await browser.tabs.query({});
        const webTabs = allTabs.filter(tab => 
            tab.url.startsWith('http') && 
            !tab.url.includes('extension://') &&
            !tab.url.startsWith('about:')
        );
        
        if (webTabs.length === 0) {
            addMessage('error', 'No valid web pages found to select from.');
            return;
        }
        
        // Show tab selection modal
        showTabSelectionModal(webTabs);
        
    } catch (error) {
        console.error('Error getting tabs:', error);
        addMessage('error', 'Could not access browser tabs.');
    }
}

// Show tab selection modal
function showTabSelectionModal(tabs) {
    // Modal container
    const modal = document.createElement('div');
    modal.id = 'tabSelectionModal';
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
        min-width: 500px;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Select Tabs for Context';
    title.style.marginTop = '0';
    modalContent.appendChild(title);

    // Instructions
    const instructions = document.createElement('p');
    instructions.textContent = 'Check the tabs you want to include in your AI context:';
    instructions.style.cssText = `
        margin-bottom: 15px;
        color: #666;
        font-size: 14px;
    `;
    modalContent.appendChild(instructions);

    // Tab list container
    const tabList = document.createElement('div');
    tabList.style.cssText = `
        margin-top: 15px;
        max-height: 400px;
        overflow-y: auto;
    `;
    modalContent.appendChild(tabList);
    
    // Get current page URL to pre-select it
    const currentUrl = currentPageContext?.url || '';
    
    tabs.forEach((tab, index) => {
        const tabItem = document.createElement('div');
        tabItem.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            margin-bottom: 8px;
            transition: background-color 0.2s;
            cursor: pointer;
        `;
        
        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `tab-${index}`;
        checkbox.dataset.tabId = tab.id;
        checkbox.style.cssText = `
            margin-right: 12px;
            transform: scale(1.2);
        `;
        
        // Pre-select current tab
        if (tab.url === currentUrl) {
            checkbox.checked = true;
            tabItem.style.backgroundColor = '#f8fff9';
            tabItem.style.borderColor = '#28a745';
        }
        
        // Tab info container
        const tabInfo = document.createElement('div');
        tabInfo.style.cssText = `
            flex: 1;
            min-width: 0;
        `;
        
        // Tab title
        const tabTitle = document.createElement('div');
        tabTitle.textContent = tab.title || 'Untitled';
        tabTitle.style.cssText = `
            font-weight: 500;
            font-size: 14px;
            margin-bottom: 4px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        
        // Tab URL
        const tabUrl = document.createElement('div');
        tabUrl.textContent = tab.url;
        tabUrl.style.cssText = `
            font-size: 12px;
            color: #666;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        `;
        
        // Current tab indicator
        if (tab.url === currentUrl) {
            const currentLabel = document.createElement('span');
            currentLabel.textContent = ' (Current)';
            currentLabel.style.cssText = `
                color: #28a745;
                font-weight: 600;
                font-size: 12px;
            `;
            tabTitle.appendChild(currentLabel);
        }
        
        tabInfo.appendChild(tabTitle);
        tabInfo.appendChild(tabUrl);
        
        // Click handler for the entire item
        const updateSelection = () => {
            if (checkbox.checked) {
                tabItem.style.backgroundColor = '#f8fff9';
                tabItem.style.borderColor = '#28a745';
            } else {
                tabItem.style.backgroundColor = 'white';
                tabItem.style.borderColor = '#ddd';
            }
        };
        
        tabItem.onclick = () => {
            checkbox.checked = !checkbox.checked;
            updateSelection();
        };
        
        checkbox.onchange = updateSelection;
        
        tabItem.appendChild(checkbox);
        tabItem.appendChild(tabInfo);
        tabList.appendChild(tabItem);
    });

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid #eee;
    `;

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        background: #6c757d;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    cancelBtn.onclick = () => document.body.removeChild(modal);

    // Apply button
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Selected Tabs';
    applyBtn.style.cssText = `
        background: #007bff;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    applyBtn.onclick = async () => {
        // Get selected tabs
        const selectedCheckboxes = modal.querySelectorAll('input[type="checkbox"]:checked');
        const selectedTabIds = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.tabId));
        
        if (selectedTabIds.length === 0) {
            alert('Please select at least one tab.');
            return;
        }
        
        // Show loading
        applyBtn.textContent = 'Loading...';
        applyBtn.disabled = true;
        
        try {
            // Extract content from selected tabs
            await loadMultiTabContext(selectedTabIds);
            document.body.removeChild(modal);
        } catch (error) {
            console.error('Error loading multi-tab context:', error);
            addMessage('error', 'Failed to load content from selected tabs.');
            applyBtn.textContent = 'Apply Selected Tabs';
            applyBtn.disabled = false;
        }
    };

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(applyBtn);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);
    document.body.appendChild(modal);
}

// Load context from multiple tabs
async function loadMultiTabContext(tabIds) {
    try {
        const tabContexts = [];
        
        for (const tabId of tabIds) {
            try {
                // First try to get tab info
                const tab = await browser.tabs.get(tabId);
                
                // Try to extract content from the tab
                const contentResponse = await browser.tabs.sendMessage(tabId, { 
                    action: 'extractContent', 
                    includeScreenshots: false 
                });
                
                if (contentResponse && contentResponse.success) {
                    tabContexts.push({
                        tabId: tabId,
                        title: contentResponse.data.title,
                        url: contentResponse.data.url,
                        content: contentResponse.data.textContent,
                        tables: contentResponse.data.tables || [],
                        charts: contentResponse.data.charts || [],
                        images: contentResponse.data.images || [],
                        estimatedTokens: Math.ceil(contentResponse.data.textContent.split(/\s+/).length * TOKEN_ESTIMATION_FACTOR)
                    });
                } else {
                    // Content script might not be injected, try to inject it
                    try {
                        await browser.scripting.executeScript({
                            target: { tabId: tabId },
                            files: ['content-script.js']
                        });
                        
                        // Wait a bit for script to load
                        await new Promise(resolve => setTimeout(resolve, 500));
                        
                        // Try again
                        const retryResponse = await browser.tabs.sendMessage(tabId, { 
                            action: 'extractContent', 
                            includeScreenshots: false 
                        });
                        
                        if (retryResponse && retryResponse.success) {
                            tabContexts.push({
                                tabId: tabId,
                                title: retryResponse.data.title,
                                url: retryResponse.data.url,
                                content: retryResponse.data.textContent,
                                tables: retryResponse.data.tables || [],
                                charts: retryResponse.data.charts || [],
                                images: retryResponse.data.images || [],
                                estimatedTokens: Math.ceil(retryResponse.data.textContent.split(/\s+/).length * TOKEN_ESTIMATION_FACTOR)
                            });
                        } else {
                            console.warn(`Could not extract content from tab ${tabId}: ${tab.title}`);
                        }
                    } catch (injectionError) {
                        console.warn(`Could not inject content script into tab ${tabId}: ${tab.title}`);
                    }
                }
            } catch (tabError) {
                console.warn(`Error accessing tab ${tabId}:`, tabError);
            }
        }
        
        if (tabContexts.length === 0) {
            throw new Error('No content could be extracted from selected tabs');
        }
        
        // Update current page context with combined context
        currentPageContext = {
            title: tabContexts.length === 1 ? 
                tabContexts[0].title : 
                `${tabContexts.length} tabs selected`,
            url: tabContexts.length === 1 ? 
                tabContexts[0].url : 
                `Multiple tabs (${tabContexts.length})`,
            content: tabContexts.map(ctx => `--- ${ctx.title} ---\n${ctx.content}`).join('\n\n'),
            tables: tabContexts.flatMap(ctx => ctx.tables),
            charts: tabContexts.flatMap(ctx => ctx.charts),
            images: tabContexts.flatMap(ctx => ctx.images),
            multiTab: true,
            tabContexts: tabContexts,
            estimatedTokens: tabContexts.reduce((sum, ctx) => sum + ctx.estimatedTokens, 0)
        };
        
        // Update UI
        updateContextDisplay();
        
        console.log(`Multi-tab context loaded: ${tabContexts.length} tabs`);
        
    } catch (error) {
        console.error('Error loading multi-tab context:', error);
        throw error;
    }
}

// Update context display in UI
function updateContextDisplay() {
    let contextInfo = '';
    let estimatedTokens = 0;

    if (currentContext && currentContext.content) {
        if (selectedTabsData.length > 1) {
            // Multi-tab context
            const titles = selectedTabsData.map(tab => tab.title).join(', ');
            const urls = selectedTabsData.map(tab => new URL(tab.url).hostname).join(', ');
            contextInfo = `Context from: ${titles} (${urls})`;
            estimatedTokens = currentContext.estimatedTokens;
        } else if (currentPageContext && currentPageContext.content) {
            // Single-tab context
            contextInfo = `Context from: ${currentPageContext.title} (${new URL(currentPageContext.url).hostname})`;
            estimatedTokens = Math.ceil(currentPageContext.content.split(/\s+/).length * TOKEN_ESTIMATION_FACTOR);
        }
    }

    elements.pageTitle.textContent = contextInfo || 'No context loaded';
    elements.pageUrl.textContent = ''; // Clear URL for better display with combined context

    // Update message input with token info and warning if applicable
    let tokenMessage = `Estimated tokens: ${estimatedTokens}`; 
    if (estimatedTokens > MAX_TOKEN_LIMIT) {
        tokenMessage += ` (Warning: Above ${MAX_TOKEN_LIMIT} tokens, accuracy may be lower)`;
        elements.messageInput.style.borderColor = 'red'; // Visual cue for warning
    } else {
        elements.messageInput.style.borderColor = ''; // Reset border color
    }
    
    // Prepend token message to the input field if it's currently empty or only contains whitespace
    if (elements.messageInput.value.trim() === '' || elements.messageInput.value.startsWith('Estimated tokens:')) {
        elements.messageInput.value = tokenMessage + '\n\n';
    } else {
        // If user has already typed, just update the tooltip/placeholder or a separate info area if needed
        // For now, let's just make sure the warning is visible
        console.log(tokenMessage); // Log to console for now if input has user text
    }

    handleInputChange(); // Adjust textarea height and send button state
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

    const modalContent = document.createElement('div');
    modalContent.className = 'export-modal-content';

    const modalHeader = document.createElement('div');
    modalHeader.className = 'export-modal-header';

    const headerTitle = document.createElement('h3');
    headerTitle.textContent = 'Export Chat as Markdown';
    modalHeader.appendChild(headerTitle);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'export-modal-close';
    closeBtn.innerHTML = '&times;'; // Using innerHTML for a simple HTML entity is generally acceptable
    modalHeader.appendChild(closeBtn);

    modalContent.appendChild(modalHeader);

    const modalBody = document.createElement('div');
    modalBody.className = 'export-modal-body';

    const exportOptions = document.createElement('div');
    exportOptions.className = 'export-options';

    const copyBtn = document.createElement('button');
    copyBtn.id = 'copyMarkdown';
    copyBtn.className = 'export-option-btn';
    copyBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy to Clipboard
    `;
    exportOptions.appendChild(copyBtn);

    const downloadBtn = document.createElement('button');
    downloadBtn.id = 'downloadMarkdown';
    downloadBtn.className = 'export-option-btn';
    downloadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7,10 12,15 17,10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        Download File
    `;
    exportOptions.appendChild(downloadBtn);

    modalBody.appendChild(exportOptions);

    const previewTextarea = document.createElement('textarea');
    previewTextarea.className = 'export-preview';
    previewTextarea.readOnly = true;
    previewTextarea.value = markdownContent;
    modalBody.appendChild(previewTextarea);

    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);

    document.body.appendChild(modal);
    
    // Event handlers
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
        console.log('=== CONTEXT MENU ACTION RECEIVED ===');
        console.log('Menu ID:', message.menuItemId);
        console.log('Selected text:', message.selectedText);
        console.log('Page URL:', message.pageUrl);
        console.log('Message sender:', sender);
        console.log('Full message:', message);
        console.log('Stack trace:', new Error().stack);
        
        // Generate appropriate prompt based on context menu selection
        let prompt = '';
        
        switch (message.menuItemId) {
            case 'summarize-page':
                prompt = 'Please summarize this page.';
                break;

            case 'quick-summary':
                prompt = message.selectedText ? 
                    `Please provide a quick summary of this selected text: "${message.selectedText}"` :
                    'Please provide a quick summary of this page.';
                break;

            case 'find-key-information':
                prompt = message.selectedText ? 
                    `What are the most important details I should know from this selected text: "${message.selectedText}"` :
                    'What are the most important details I should know from this page?';
                break;

            case 'main-points':
                prompt = message.selectedText ? 
                    `What are the main points of this selected text in bullet points: "${message.selectedText}"` :
                    'What are the main points of this page in bullet points?';
                break;

            case 'take-notes':
                prompt = message.selectedText ? 
                    `Help me create organized notes from this selected text: "${message.selectedText}"` :
                    'Help me create organized notes from this content';
                break;
        }
        
        // Set the prompt in the input field (user must manually send)
        if (prompt && prompt.trim() !== '') {
            // Clear input field first to prevent duplication
            elements.messageInput.value = '';
            elements.messageInput.value = prompt;
            handleInputChange(); // Update send button state
            
            // Focus the input field to indicate it's ready for editing/sending
            elements.messageInput.focus();
        } else {
            // Just focus the input field for clean start
            elements.messageInput.focus();
        }
    }
});

// Note: Sidebar initialization is already handled by the existing DOMContentLoaded listener above 