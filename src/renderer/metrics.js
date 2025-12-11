const refreshBtn = document.getElementById('refreshBtn');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const connectionStatus = document.getElementById('connectionStatus');
const metricsContent = document.getElementById('metricsContent');
const connectionResult = document.getElementById('connectionResult');
const claimsProcessed = document.getElementById('claimsProcessed');
const avgDuration = document.getElementById('avgDuration');
const totalTime = document.getElementById('totalTime');
const claimTypeMetrics = document.getElementById('claimTypeMetrics');

let isApiConnected = false;

async function checkApiConnection() {
    try {
        if (!window.electronAPI || !window.electronAPI.getApiStatus) {
            return false;
        }
        
        const status = await window.electronAPI.getApiStatus();
        return status && status.connected;
    } catch (error) {
        console.error('Error checking API status:', error);
        return false;
    }
}

async function testConnection() {
    testConnectionBtn.disabled = true;
    testConnectionBtn.textContent = '🔄 Testing...';
    connectionResult.className = 'connection-result';
    connectionResult.style.display = 'none';
    
    try {
        const connected = await checkApiConnection();
        
        if (connected) {
            connectionResult.className = 'connection-result success';
            connectionResult.textContent = '✅ API connection successful! Loading metrics...';
            connectionResult.style.display = 'block';
            
            isApiConnected = true;
            
            // Hide connection status and show metrics
            setTimeout(() => {
                connectionStatus.classList.add('hidden');
                metricsContent.classList.remove('hidden');
                loadMetrics();
            }, 1500);
        } else {
            connectionResult.className = 'connection-result error';
            connectionResult.textContent = '❌ API connection failed. Please ensure the API server is running.';
            connectionResult.style.display = 'block';
            isApiConnected = false;
        }
    } catch (error) {
        connectionResult.className = 'connection-result error';
        connectionResult.textContent = '❌ Error testing connection: ' + error.message;
        connectionResult.style.display = 'block';
        isApiConnected = false;
    } finally {
        testConnectionBtn.disabled = false;
        testConnectionBtn.textContent = '🔄 Test API Connection';
    }
}

async function loadMetrics() {
    if (!isApiConnected) {
        return;
    }
    
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
                html += `<div class="metric-cell"><strong>${m.claimType || m.claim_type || 'Unknown'}</strong></div>`;
                html += `<div class="metric-cell">${m.totalClaims || m.total_claims}</div>`;
                html += `<div class="metric-cell">${formatDuration(m.avgDuration || m.avg_duration)}</div>`;
                html += `<div class="metric-cell">${formatDuration(m.minDuration || m.min_duration)} / ${formatDuration(m.maxDuration || m.max_duration)}</div>`;
                html += '</div>';
            });

            claimTypeMetrics.innerHTML = html;
        } else {
            claimTypeMetrics.innerHTML = '<p style="text-align: center; color: #666;">No claim data available yet.</p>';
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
        claimTypeMetrics.innerHTML = '<p style="text-align: center; color: #e74c3c;">Error loading metrics. Please check API connection.</p>';
    }
}

function formatDuration(seconds) {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function initializeMetrics() {
    // Check initial API connection
    const connected = await checkApiConnection();
    
    if (connected) {
        isApiConnected = true;
        connectionStatus.classList.add('hidden');
        metricsContent.classList.remove('hidden');
        loadMetrics();
        // Auto-refresh every 10 seconds when connected
        setInterval(() => {
            if (isApiConnected) {
                loadMetrics();
            }
        }, 10000);
    } else {
        isApiConnected = false;
        connectionStatus.classList.remove('hidden');
        metricsContent.classList.add('hidden');
    }
}

// Event listeners
if (refreshBtn) {
    refreshBtn.addEventListener('click', loadMetrics);
}

if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', testConnection);
}

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMetrics);
} else {
    // DOM is already loaded
    initializeMetrics();
}
