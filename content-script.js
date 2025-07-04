// Content script for extracting page information
console.log('AI Page Summarizer content script loaded');

// Function to extract main content from the page
function extractPageContent() {
  // Get basic page info
  const title = document.title;
  const url = window.location.href;
  
  // Extract meta description
  const metaDescription = document.querySelector('meta[name="description"]');
  const description = metaDescription ? metaDescription.getAttribute('content') : '';
  
  // Extract meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]');
  const keywords = metaKeywords ? metaKeywords.getAttribute('content').split(',').map(k => k.trim()) : [];
  
  // Extract author
  const metaAuthor = document.querySelector('meta[name="author"]');
  const author = metaAuthor ? metaAuthor.getAttribute('content') : '';
  
  // Extract main content - try multiple selectors for better content detection
  let mainContent = '';
  
  // Common content selectors (ordered by specificity)
  const contentSelectors = [
    'article',
    'main',
    '[role="main"]',
    '.content',
    '.post-content',
    '.entry-content',
    '.article-content',
    '#content',
    '.main-content',
    'body'
  ];
  
  let contentElement = null;
  for (const selector of contentSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) {
      break;
    }
  }
  
  if (contentElement) {
    // Clone the element to avoid modifying the original
    const clone = contentElement.cloneNode(true);
    
    // Remove unwanted elements
    const unwantedSelectors = [
      'nav', 'header', 'footer', 'aside',
      '.nav', '.navigation', '.menu',
      '.sidebar', '.widget', '.advertisement',
      '.social-share', '.comments', '.comment',
      'script', 'style', 'noscript'
    ];
    
    unwantedSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // Get text content and clean it up
    mainContent = clone.textContent || clone.innerText || '';
    
    // Clean up whitespace
    mainContent = mainContent
      .replace(/\s+/g, ' ')  // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n')  // Remove empty lines
      .trim();
    
    // Limit content length to prevent huge requests
    if (mainContent.length > 5000) {
      mainContent = mainContent.substring(0, 5000) + '...';
    }
  }
  
  // Return structured data
  return {
    title: title,
    url: url,
    textContent: mainContent,
    metadata: {
      description: description,
      keywords: keywords,
      author: author
    }
  };
}

// Listen for messages from popup/background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    console.log('Content extraction requested');
    
    try {
      const pageContent = extractPageContent();
      console.log('Page content extracted:', pageContent);
      
      // Send response back
      sendResponse({
        success: true,
        data: pageContent
      });
    } catch (error) {
      console.error('Error extracting content:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  
  return true; // Keep message channel open for async response
}); 