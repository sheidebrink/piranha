const refreshBtn = document.getElementById('refreshBtn');
const claimsProcessed = document.getElementById('claimsProcessed');
const avgDuration = document.getElementById('avgDuration');
const totalTime = document.getElementById('totalTime');
const claimTypeMetrics = document.getElementById('claimTypeMetrics');

async function loadMetrics() {
    try {
        // Check if electronAPI is available
        if (!window.electronAPI) {
            console.error('electronAPI not available');
            claimTypeMetrics.innerHTML = '<p style="text-align: center; color: #666;">Loading...</p>';
            return;
        }

        const summary = await window.electronAPI.getSessionSummary();
        const metrics = await window.electronAPI.getMetrics({});

        // Update session metrics
        claimsProcessed.textContent = summary.claims_processed || 0;
        avgDuration.textContent = formatDuration(summary.avg_claim_duration);
        totalTime.textContent = formatDuration(summary.total_time_seconds);

        // Update claim type metrics
        if (metrics && metrics.length > 0) {
            let html = '<div class="metric-row metric-row-header">';
            html += '<div class="metric-cell">Claim Type</div>';
            html += '<div class="metric-cell">Total Claims</div>';
            html += '<div class="metric-cell">Avg Duration</div>';
            html += '<div class="metric-cell">Min / Max</div>';
            html += '</div>';

            metrics.forEach(m => {
                html += '<div class="metric-row">';
                html += `<div class="metric-cell"><strong>${m.claim_type || 'Unknown'}</strong></div>`;
                html += `<div class="metric-cell">${m.total_claims}</div>`;
                html += `<div class="metric-cell">${formatDuration(m.avg_duration)}</div>`;
                html += `<div class="metric-cell">${formatDuration(m.min_duration)} / ${formatDuration(m.max_duration)}</div>`;
                html += '</div>';
            });

            claimTypeMetrics.innerHTML = html;
        } else {
            claimTypeMetrics.innerHTML = '<p style="text-align: center; color: #666;">No claim data available yet.</p>';
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

function formatDuration(seconds) {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

if (refreshBtn) {
    refreshBtn.addEventListener('click', loadMetrics);
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadMetrics();
        // Auto-refresh every 10 seconds
        setInterval(loadMetrics, 10000);
    });
} else {
    // DOM is already loaded
    loadMetrics();
    // Auto-refresh every 10 seconds
    setInterval(loadMetrics, 10000);
}
