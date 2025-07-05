// SVG content
const svgContent = `
    <svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
        <circle cx="64" cy="64" r="58" fill="#667eea" stroke="#764ba2" stroke-width="4"/>
        <rect x="32" y="30" width="48" height="60" rx="4" fill="white" opacity="0.9"/>
        <rect x="32" y="30" width="48" height="8" rx="4" fill="#764ba2"/>
        <line x1="40" y1="48" x2="72" y2="48" stroke="#667eea" stroke-width="2" stroke-linecap="round"/>
        <line x1="40" y1="54" x2="64" y2="54" stroke="#667eea" stroke-width="2" stroke-linecap="round"/>
        <line x1="40" y1="60" x2="68" y2="60" stroke="#667eea" stroke-width="2" stroke-linecap="round"/>
        <line x1="40" y1="66" x2="60" y2="66" stroke="#667eea" stroke-width="2" stroke-linecap="round"/>
        <circle cx="96" cy="48" r="12" fill="#4caf50" opacity="0.8"/>
        <circle cx="96" cy="48" r="6" fill="white"/>
        <circle cx="96" cy="48" r="2" fill="#4caf50"/>
        <line x1="80" y1="45" x2="88" y2="45" stroke="#4caf50" stroke-width="2" stroke-linecap="round"/>
        <line x1="80" y1="51" x2="88" y2="51" stroke="#4caf50" stroke-width="2" stroke-linecap="round"/>
        <path d="M108 32 L110 36 L114 34 L112 38 L116 40 L112 42 L114 46 L110 44 L108 48 L106 44 L102 46 L104 42 L100 40 L104 38 L102 34 L106 36 Z" fill="#ffd700" opacity="0.7"/>
    </svg>
`;

// Function to render SVG to canvas
function renderSVGToCanvas(canvasId, size) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');

    // Create blob from SVG
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    // Create image and draw to canvas
    const img = new Image();
    img.onload = function () {
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

// Function to download canvas as PNG
function downloadIcon(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

// Render all icons on page load
window.addEventListener('load', function () {
    renderSVGToCanvas('canvas16', 16);
    renderSVGToCanvas('canvas32', 32);
    renderSVGToCanvas('canvas48', 48);
    renderSVGToCanvas('canvas128', 128);
}); 