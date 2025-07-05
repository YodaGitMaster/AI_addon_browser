function createIcon(canvas, size) {
    const ctx = canvas.getContext('2d');

    // Create gradient background
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');

    // Draw background circle
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, 2 * Math.PI);
    ctx.fill();

    // Draw document shape
    const docWidth = size * 0.4;
    const docHeight = size * 0.5;
    const docX = size * 0.25;
    const docY = size * 0.2;

    ctx.fillStyle = 'white';
    ctx.fillRect(docX, docY, docWidth, docHeight);

    // Draw document header
    ctx.fillStyle = '#764ba2';
    ctx.fillRect(docX, docY, docWidth, size * 0.08);

    // Draw text lines (if icon is large enough)
    if (size >= 32) {
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = size >= 48 ? 2 : 1;

        const lineStart = docX + size * 0.05;
        const lineEnd = docX + docWidth - size * 0.05;
        const lineSpacing = size * 0.06;
        let lineY = docY + size * 0.15;

        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(lineStart, lineY);
            ctx.lineTo(lineEnd - (i * size * 0.03), lineY);
            ctx.stroke();
            lineY += lineSpacing;
        }
    }

    // Draw AI indicator (small green circle)
    if (size >= 24) {
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.arc(size * 0.75, size * 0.35, size * 0.08, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(size * 0.75, size * 0.35, size * 0.04, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function downloadCanvas(canvas, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function generateAllIcons() {
    const statusEl = document.getElementById('status');
    const previewEl = document.getElementById('preview');

    statusEl.textContent = 'Generating icons...';
    statusEl.className = 'status';
    statusEl.style.display = 'block';

    // Clear preview
    previewEl.innerHTML = '';

    const sizes = [16, 32, 48, 128];
    let completed = 0;

    sizes.forEach(size => {
        const canvas = document.getElementById(`canvas${size}`);
        createIcon(canvas, size);

        // Add to preview
        const iconItem = document.createElement('div');
        iconItem.className = 'icon-item';
        iconItem.innerHTML = `
            <h4>${size}x${size}</h4>
            <img src="${canvas.toDataURL('image/png')}" style="border: 1px solid #ddd;" alt="${size}x${size} icon">
        `;
        previewEl.appendChild(iconItem);

        // Auto-download
        setTimeout(() => {
            downloadCanvas(canvas, `icon-${size}.png`);
            completed++;

            if (completed === sizes.length) {
                statusEl.textContent = '✅ All icons generated and downloaded! Save them to your icons/ folder.';
                statusEl.className = 'status success';
            }
        }, 100 * (size / 16)); // Stagger downloads slightly
    });
}

// Auto-generate on page load for convenience
window.addEventListener('load', () => {
    generateAllIcons();
}); 