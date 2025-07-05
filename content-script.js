// Content script for extracting page information
console.log('AI Page Summarizer content script loaded');

// Function to extract main content from the page
async function extractPageContent(includeScreenshots = false) {
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
  
  // Extract tables
  const tables = extractTables();
  
  // Detect charts and graphs (conditionally including screenshots)
  const charts = await detectCharts(includeScreenshots);
  
  // Extract main content - prioritize main element, fallback to full page
  let mainContent = '';
  let contentSource = 'unknown';
  
  // Priority content selectors (article > main > all page)
  const contentSelectors = [
    { selector: 'article', name: 'article element' },
    { selector: 'main', name: 'main element' },
    { selector: '[role="main"]', name: 'main role' },
    { selector: '.content', name: 'content class' },
    { selector: '.post-content', name: 'post content' },
    { selector: '.entry-content', name: 'entry content' },
    { selector: '.article-content', name: 'article content' },
    { selector: '#content', name: 'content id' },
    { selector: '.main-content', name: 'main content class' },
    { selector: 'body', name: 'full page body' }
  ];
  
  let contentElement = null;
  for (const { selector, name } of contentSelectors) {
    contentElement = document.querySelector(selector);
    if (contentElement) {
      contentSource = name;
      console.log(`AI Page Chat: Using ${name} for content extraction`);
      break;
    }
  }
  
  if (contentElement) {
    // Clone the element to avoid modifying the original
    const clone = contentElement.cloneNode(true);
    
    // Remove unwanted elements - comprehensive list of accessory elements
    const unwantedSelectors = [
      // Navigation elements
      'nav', 'header', 'footer', 'aside',
      '.nav', '.navigation', '.menu', '.navbar', '.nav-bar',
      '.breadcrumb', '.breadcrumbs', '.crumb', '.crumbs',
      '.pagination', '.pager', '.page-nav',
      
      // Sidebar and widget areas
      '.sidebar', '.side-bar', '.widget', '.widgets',
      '.left-sidebar', '.right-sidebar', '.sidebar-left', '.sidebar-right',
      '.secondary', '.tertiary', '.complementary',
      
      // Advertising and promotional content
      '.advertisement', '.ad', '.ads', '.advert', '.banner',
      '.promo', '.promotion', '.promotional', '.sponsored',
      '.affiliate', '.marketing', '.campaign',
      
      // Social and sharing elements
      '.social', '.social-share', '.share', '.sharing',
      '.follow', '.subscribe', '.newsletter',
      '.social-media', '.social-links', '.social-icons',
      
      // Comments and user interaction
      '.comments', '.comment', '.comment-section',
      '.reviews', '.review', '.rating', '.ratings',
      '.feedback', '.discussion', '.replies',
      
      // Related content and recommendations
      '.related', '.related-posts', '.related-articles',
      '.recommended', '.suggestions', '.more-posts',
      '.popular', '.trending', '.you-might-like',
      
      // Footnotes and references
      '.footnotes', '.footnote', '.references', '.refs',
      '.endnotes', '.bibliography', '.citations',
      
      // Metadata and publication info
      '.meta', '.metadata', '.post-meta', '.article-meta',
      '.byline', '.author-info', '.publish-date',
      '.tags', '.categories', '.taxonomy',
      
      // Search and filters
      '.search', '.search-form', '.filter', '.filters',
      '.sort', '.sorting', '.facets',
      
      // Cookie notices and legal
      '.cookie', '.cookies', '.gdpr', '.privacy-notice',
      '.legal', '.disclaimer', '.terms',
      
      // Popups and overlays
      '.popup', '.modal', '.overlay', '.lightbox',
      '.tooltip', '.dropdown', '.flyout',
      
      // Skip links and accessibility
      '.skip-link', '.skip-nav', '.screen-reader',
      '.sr-only', '.visually-hidden', '.accessibility',
      
      // Technical elements
      'script', 'style', 'noscript', 'iframe',
      '.embed', '.embedded', '.video-player',
      
      // Common CMS and theme elements
      '.wp-block-group', '.wp-block-columns', '.wp-block-sidebar',
      '.elementor-widget', '.vc_row', '.fusion-builder',
      '.et_pb_section', '.et_pb_row',
      
      // Print and media-specific
      '.print-only', '.no-print', '.mobile-only', '.desktop-only',
      
      // Common ID-based elements
      '#header', '#footer', '#sidebar', '#navigation',
      '#comments', '#related', '#social', '#ads'
    ];
    
    let removedCount = 0;
    unwantedSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      removedCount += elements.length;
      elements.forEach(el => el.remove());
    });
    
    // Remove elements with common unwanted attributes
    const attributeSelectors = [
      '[role="banner"]', '[role="navigation"]', '[role="complementary"]',
      '[role="contentinfo"]', '[role="search"]', '[role="form"]',
      '[data-ad]', '[data-advertisement]', '[data-widget]',
      '[class*="ad-"]', '[class*="advertisement"]', '[class*="promo"]',
      '[class*="sidebar"]', '[class*="widget"]', '[class*="social"]'
    ];
    
    attributeSelectors.forEach(selector => {
      const elements = clone.querySelectorAll(selector);
      removedCount += elements.length;
      elements.forEach(el => el.remove());
    });
    
    // Remove very small text blocks (likely noise)
    const textElements = clone.querySelectorAll('div, p, span');
    let smallElementsRemoved = 0;
    textElements.forEach(el => {
      const text = el.textContent.trim();
      if (text.length < 10 && !el.querySelector('img, video, canvas')) {
        el.remove();
        smallElementsRemoved++;
      }
    });
    
    console.log(`AI Page Chat: Removed ${removedCount} accessory elements and ${smallElementsRemoved} small text blocks`);
    
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
  
  // Check content quality and add info
  const contentInfo = {
    source: contentSource,
    length: mainContent.length,
    hasMainElement: !!document.querySelector('main'),
    fallbackUsed: contentSource === 'full page body'
  };
  
  console.log('AI Page Chat: Content extraction info:', contentInfo);
  
  // Return structured data
  return {
    title: title,
    url: url,
    textContent: mainContent,
    tables: tables,
    charts: charts,
    contentInfo: contentInfo,
    metadata: {
      description: description,
      keywords: keywords,
      author: author
    }
  };
}

// Function to extract tables from the page
function extractTables() {
  const tables = [];
  const tableElements = document.querySelectorAll('table');
  
  tableElements.forEach((table, index) => {
    const tableData = {
      id: index + 1,
      headers: [],
      rows: [],
      caption: ''
    };
    
    // Extract caption
    const caption = table.querySelector('caption');
    if (caption) {
      tableData.caption = caption.textContent.trim();
    }
    
    // Extract headers
    const headerRows = table.querySelectorAll('thead tr, tr:first-child');
    if (headerRows.length > 0) {
      const headerCells = headerRows[0].querySelectorAll('th, td');
      headerCells.forEach(cell => {
        tableData.headers.push(cell.textContent.trim());
      });
    }
    
    // Extract data rows
    const bodyRows = table.querySelectorAll('tbody tr, tr:not(:first-child)');
    bodyRows.forEach(row => {
      const rowData = [];
      const cells = row.querySelectorAll('td, th');
      cells.forEach(cell => {
        rowData.push(cell.textContent.trim());
      });
      if (rowData.length > 0) {
        tableData.rows.push(rowData);
      }
    });
    
    // Only include tables with actual data
    if (tableData.headers.length > 0 || tableData.rows.length > 0) {
      tables.push(tableData);
    }
  });
  
  return tables;
}

// Function to compress an image
async function compressImage(dataUrl, quality = 0.7) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Reduce dimensions to compress further
      const maxWidth = 1200;
      const maxHeight = 800;
      
      let { width, height } = img;
      
      // Calculate new dimensions while maintaining aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedDataUrl);
    };
    
    img.src = dataUrl;
  });
}

// Function to capture a full page screenshot
async function captureFullPageScreenshot() {
  try {
    // Use the browser's tab capture API to get a screenshot
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Try to use html2canvas if available, otherwise fall back to basic method
    if (typeof html2canvas !== 'undefined') {
      const screenshot = await html2canvas(document.body);
      return screenshot.toDataURL('image/png');
    } else {
      // Fallback: request screenshot from background script
      return new Promise((resolve) => {
        browser.runtime.sendMessage({action: 'captureScreenshot'}, (response) => {
          resolve(response?.screenshot || null);
        });
      });
    }
  } catch (error) {
    console.warn('Could not capture full page screenshot:', error);
    return null;
  }
}

// Function to capture a canvas as a data URL
function captureCanvasScreenshot(canvas) {
  try {
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.warn('Could not capture canvas screenshot due to security restrictions:', error);
    return null;
  }
}

// Function to detect charts and graphs on the page
async function detectCharts(includeScreenshots = false) {
  const charts = [];
  
  // Only capture screenshots if explicitly requested
  if (includeScreenshots) {
    console.log('Screenshots requested - capturing full page screenshot...');
    
    try {
      const fullPageScreenshot = await new Promise((resolve) => {
        browser.runtime.sendMessage({action: 'captureScreenshot'}, (response) => {
          resolve(response?.screenshot || null);
        });
      });
      
      if (fullPageScreenshot) {
        console.log('Full page screenshot captured successfully');
        
        // Compress the image to reduce size
        const compressedScreenshot = await compressImage(fullPageScreenshot, 0.7); // 70% quality
        
        charts.push({
          type: 'fullpage',
          id: 'fullpage-screenshot',
          width: window.innerWidth,
          height: window.innerHeight,
          context: 'full-page',
          description: 'Full page screenshot including all charts and content',
          screenshot: compressedScreenshot
        });
      } else {
        console.warn('Full page screenshot capture failed');
      }
    } catch (error) {
      console.error('Error capturing full page screenshot:', error);
    }
  } else {
    console.log('Screenshots not requested - skipping screenshot capture');
  }
  
  // First, specifically look for trading chart canvases
  const paneCanvases = document.querySelectorAll('canvas[data-name="pane-canvas"]');
  console.log('Found pane-canvas elements:', paneCanvases.length);
  
  paneCanvases.forEach((canvas, index) => {
    console.log(`Pane Canvas ${index + 1}:`, {
      width: canvas.width,
      height: canvas.height,
      className: canvas.className,
      dataName: canvas.getAttribute('data-name'),
      style: canvas.style.cssText,
      isVisible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
    });
    
    const screenshot = includeScreenshots ? captureCanvasScreenshot(canvas) : null;
    console.log(`Pane Canvas ${index + 1} screenshot:`, includeScreenshots ? (screenshot ? 'Success' : 'Failed') : 'Skipped');
    
    if (screenshot) {
      console.log(`Pane Canvas ${index + 1} screenshot length:`, screenshot.length);
    }
    
    charts.push({
      type: 'canvas',
      id: `pane-canvas-${index + 1}`,
      width: canvas.width,
      height: canvas.height,
      context: 'trading-chart',
      description: 'Trading chart pane canvas',
      screenshot: screenshot
    });
  });
  
  // Check for other Canvas elements (Chart.js, D3.js, etc.)
  const canvasElements = document.querySelectorAll('canvas:not([data-name="pane-canvas"])');
  console.log('Found other canvas elements:', canvasElements.length);
  
  canvasElements.forEach((canvas, index) => {
    console.log(`Canvas ${index + 1}:`, {
      width: canvas.width,
      height: canvas.height,
      className: canvas.className,
      dataName: canvas.getAttribute('data-name'),
      style: canvas.style.cssText,
      isVisible: canvas.offsetWidth > 0 && canvas.offsetHeight > 0
    });
    
    // Check if canvas might be a chart - improved detection
    const parent = canvas.closest('[class*="chart"], [id*="chart"], [class*="graph"], [id*="graph"], [class*="trading"], [id*="trading"]');
    const isChartCanvas = canvas.getAttribute('data-name') === 'pane-canvas' || 
                         canvas.className.includes('chart') || 
                         canvas.className.includes('graph') ||
                         canvas.getAttribute('data-name')?.includes('chart') ||
                         canvas.getAttribute('data-name')?.includes('pane') ||
                         canvas.width > 200 || canvas.height > 200; // Larger canvases are more likely to be charts
    
    if (parent || isChartCanvas) {
      console.log(`Canvas ${index + 1} qualifies as chart canvas`);
      
      const screenshot = includeScreenshots ? captureCanvasScreenshot(canvas) : null;
      console.log(`Canvas ${index + 1} screenshot:`, includeScreenshots ? (screenshot ? 'Success' : 'Failed') : 'Skipped');
      
      if (screenshot) {
        console.log(`Canvas ${index + 1} screenshot length:`, screenshot.length);
        console.log(`Canvas ${index + 1} screenshot preview:`, screenshot.substring(0, 100) + '...');
      }
      
      charts.push({
        type: 'canvas',
        id: `canvas-${index + 1}`,
        width: canvas.width,
        height: canvas.height,
        context: parent ? parent.className : '',
        description: canvas.getAttribute('aria-label') || canvas.title || canvas.getAttribute('data-name') || '',
        screenshot: screenshot // Add the screenshot data URL
      });
    }
  });
  
  console.log('Total canvas charts detected:', charts.length);
  console.log('Canvas charts with screenshots:', charts.filter(c => c.screenshot).length);
  
  // Check for SVG charts - be more selective
  const svgElements = document.querySelectorAll('svg');
  console.log('Found SVG elements:', svgElements.length);
  
  svgElements.forEach((svg, index) => {
    // Be much more selective about SVG elements
    const parent = svg.closest('[class*="chart"], [id*="chart"], [class*="graph"], [id*="graph"]');
    const hasChartElements = svg.querySelectorAll('rect, circle, path, line').length > 10; // Require more elements
    const isLargeEnough = (svg.getBoundingClientRect().width > 200 && svg.getBoundingClientRect().height > 100);
    
    // Only include SVGs that are clearly charts, not UI icons
    if (parent && hasChartElements && isLargeEnough) {
      console.log(`SVG ${index + 1} qualifies as chart:`, {
        width: svg.getBoundingClientRect().width,
        height: svg.getBoundingClientRect().height,
        elements: svg.querySelectorAll('rect, circle, path, line').length
      });
      
      charts.push({
        type: 'svg',
        id: `svg-${index + 1}`,
        width: svg.getAttribute('width') || svg.viewBox?.baseVal?.width || svg.getBoundingClientRect().width,
        height: svg.getAttribute('height') || svg.viewBox?.baseVal?.height || svg.getBoundingClientRect().height,
        context: parent ? parent.className : '',
        description: svg.getAttribute('aria-label') || svg.querySelector('title')?.textContent || ''
      });
    }
  });
  
  console.log('Total SVG charts detected:', charts.filter(c => c.type === 'svg').length);
  
  // Check for common chart containers - also be more selective
  const chartContainers = document.querySelectorAll(
    '[class*="chart"]:not([class*="chart-icon"]):not([class*="chart-button"]), ' +
    '[id*="chart"], [class*="graph"], [id*="graph"], ' +
    '[class*="visualization"], [class*="plot"], [class*="diagram"]'
  );
  
  console.log('Found chart containers:', chartContainers.length);
  
  chartContainers.forEach((container, index) => {
    // Only include containers that don't already have canvas/svg and have substantial content
    if (!container.querySelector('canvas, svg') && container.textContent.length > 50) {
      console.log(`Container ${index + 1} qualifies as chart container:`, {
        className: container.className,
        textLength: container.textContent.length,
        hasCanvas: !!container.querySelector('canvas'),
        hasSvg: !!container.querySelector('svg')
      });
      
      charts.push({
        type: 'container',
        id: `container-${index + 1}`,
        className: container.className,
        textContent: container.textContent.substring(0, 200).trim(),
        description: container.getAttribute('aria-label') || container.title || ''
      });
    }
  });
  
  console.log('Total container charts detected:', charts.filter(c => c.type === 'container').length);
  
  // Check for image charts
  const images = document.querySelectorAll('img[src*="chart"], img[src*="graph"], img[alt*="chart"], img[alt*="graph"]');
  images.forEach((img, index) => {
    charts.push({
      type: 'image',
      id: `image-${index + 1}`,
      src: img.src,
      alt: img.alt,
      description: img.title || img.alt || ''
    });
  });
  
  console.log('Total image charts detected:', charts.filter(c => c.type === 'image').length);
  console.log('FINAL TOTAL charts detected:', charts.length);
  console.log('Charts with screenshots:', charts.filter(c => c.screenshot).length);
  
  return charts;
}

// Listen for messages from popup/background script
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    console.log('Content extraction requested, includeScreenshots:', request.includeScreenshots);
    
    // Handle async function
    extractPageContent(request.includeScreenshots).then(pageContent => {
      console.log('Page content extracted:', pageContent);
      
      // Send response back
      sendResponse({
        success: true,
        data: pageContent
      });
    }).catch(error => {
      console.error('Error extracting content:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    });
    
    return true; // Keep message channel open for async response
  }
}); 