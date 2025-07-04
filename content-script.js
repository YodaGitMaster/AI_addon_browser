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
  
  // Extract tables
  const tables = extractTables();
  
  // Detect charts and graphs
  const charts = detectCharts();
  
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
    tables: tables,
    charts: charts,
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

// Function to detect charts and graphs on the page
function detectCharts() {
  const charts = [];
  
  // Check for Canvas elements (Chart.js, D3.js, etc.)
  const canvasElements = document.querySelectorAll('canvas');
  canvasElements.forEach((canvas, index) => {
    // Check if canvas might be a chart (has some context or is in a chart container)
    const parent = canvas.closest('[class*="chart"], [id*="chart"], [class*="graph"], [id*="graph"]');
    if (parent || canvas.width > 100 || canvas.height > 100) {
      charts.push({
        type: 'canvas',
        id: `canvas-${index + 1}`,
        width: canvas.width,
        height: canvas.height,
        context: parent ? parent.className : '',
        description: canvas.getAttribute('aria-label') || canvas.title || ''
      });
    }
  });
  
  // Check for SVG charts
  const svgElements = document.querySelectorAll('svg');
  svgElements.forEach((svg, index) => {
    // Check if SVG might be a chart
    const parent = svg.closest('[class*="chart"], [id*="chart"], [class*="graph"], [id*="graph"]');
    const hasChartElements = svg.querySelectorAll('rect, circle, path, line').length > 5;
    
    if (parent || hasChartElements) {
      charts.push({
        type: 'svg',
        id: `svg-${index + 1}`,
        width: svg.getAttribute('width') || svg.viewBox?.baseVal?.width,
        height: svg.getAttribute('height') || svg.viewBox?.baseVal?.height,
        context: parent ? parent.className : '',
        description: svg.getAttribute('aria-label') || svg.querySelector('title')?.textContent || ''
      });
    }
  });
  
  // Check for common chart containers
  const chartContainers = document.querySelectorAll(
    '[class*="chart"], [id*="chart"], [class*="graph"], [id*="graph"], ' +
    '[class*="visualization"], [class*="plot"], [class*="diagram"]'
  );
  
  chartContainers.forEach((container, index) => {
    if (!container.querySelector('canvas, svg')) {
      // Might be an image-based chart or other visualization
      charts.push({
        type: 'container',
        id: `container-${index + 1}`,
        className: container.className,
        textContent: container.textContent.substring(0, 200).trim(),
        description: container.getAttribute('aria-label') || container.title || ''
      });
    }
  });
  
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
  
  return charts;
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