let currentUserId = null;
let currentUser = null;

// DOM elements
const backBtn = document.getElementById('backBtn');
const userTitle = document.getElementById('userTitle');
const userSubtitle = document.getElementById('userSubtitle');
const metricsContent = document.getElementById('metricsContent');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('User metrics page loaded');
  
  // Get user ID from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  currentUserId = urlParams.get('userId');
  
  if (currentUserId) {
    loadUserMetrics(parseInt(currentUserId));
  } else {
    showError('No user ID provided');
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  backBtn.addEventListener('click', () => {
    window.close();
  });
}

async function loadUserMetrics(userId) {
  try {
    console.log('Loading metrics for user:', userId);
    
    // Show loading state
    userTitle.textContent = 'Loading User Metrics...';
    userSubtitle.textContent = 'Please wait while we fetch the data';
    metricsContent.innerHTML = '<div class="loading">Loading comprehensive metrics data...</div>';
    
    // Fetch user metrics
    const metrics = await window.electronAPI.getUserMetrics(userId);
    
    if (metrics) {
      currentUser = {
        id: metrics.userId,
        username: metrics.username,
        email: metrics.email
      };
      
      // Update header
      userTitle.textContent = `Metrics for ${metrics.username}`;
      userSubtitle.textContent = `${metrics.email} • User ID: ${metrics.userId}`;
      
      // Render metrics
      renderUserMetrics(metrics);
    } else {
      showError('No metrics data available for this user');
    }
  } catch (error) {
    console.error('Failed to load user metrics:', error);
    showError('Error loading user metrics');
  }
}

function renderUserMetrics(metrics) {
  const html = `
    <div class="metrics-overview">
      <div class="metric-card">
        <h4>Total Sessions</h4>
        <div class="value">${metrics.totalSessions}</div>
        <div class="subtitle">Login sessions</div>
      </div>
      <div class="metric-card">
        <h4>Total Claims</h4>
        <div class="value">${metrics.totalClaims}</div>
        <div class="subtitle">Claims processed</div>
      </div>
      <div class="metric-card">
        <h4>Avg Claim Duration</h4>
        <div class="value">${Math.round(metrics.avgClaimDuration)}<span class="unit">sec</span></div>
        <div class="subtitle">Average processing time</div>
      </div>
      <div class="metric-card">
        <h4>Total Events</h4>
        <div class="value">${metrics.totalEvents}</div>
        <div class="subtitle">Tracked interactions</div>
      </div>
      <div class="metric-card">
        <h4>Last Activity</h4>
        <div class="value" style="font-size: 16px; line-height: 1.3;">
          ${metrics.lastActivity ? formatDate(metrics.lastActivity) : 'Never'}
        </div>
        <div class="subtitle">Most recent session</div>
      </div>
    </div>

    ${metrics.recentSessions.length > 0 ? `
    <div class="metrics-section">
      <div class="section-header">
        <h3>📊 Recent Sessions</h3>
      </div>
      <div class="section-content">
        <table class="sessions-table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Start Time</th>
              <th>Duration</th>
              <th>Claims Processed</th>
              <th>Total Events</th>
              <th>Avg Claim Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.recentSessions.map(session => `
              <tr>
                <td><span class="session-id">#${session.sessionId}</span></td>
                <td>${formatDateTime(session.startTime)}</td>
                <td>
                  ${session.totalTimeSeconds > 0 
                    ? `<span class="duration-badge">${formatDuration(session.totalTimeSeconds)}</span>`
                    : `<span class="active-badge">Active</span>`
                  }
                </td>
                <td><strong>${session.claimsProcessed}</strong></td>
                <td>${session.totalEvents}</td>
                <td>${session.avgClaimDuration > 0 ? Math.round(session.avgClaimDuration) + 's' : '-'}</td>
                <td>${session.endTime ? 'Completed' : 'Active'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : `
    <div class="metrics-section">
      <div class="section-header">
        <h3>📊 Recent Sessions</h3>
      </div>
      <div class="section-content">
        <div class="no-data">No session data available</div>
      </div>
    </div>
    `}

    ${metrics.claimTypeBreakdown.length > 0 ? `
    <div class="metrics-section">
      <div class="section-header">
        <h3>🏷️ Claim Type Performance</h3>
      </div>
      <div class="section-content">
        <table class="claims-table">
          <thead>
            <tr>
              <th>Claim Type</th>
              <th>Total Claims</th>
              <th>Avg Duration</th>
              <th>Min Duration</th>
              <th>Max Duration</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            ${metrics.claimTypeBreakdown.map(claim => `
              <tr>
                <td>
                  <span class="claim-type-badge claim-type-${claim.claimType}">
                    ${claim.claimType.replace('_', ' ')}
                  </span>
                </td>
                <td><strong>${claim.totalClaims}</strong></td>
                <td>${Math.round(claim.avgDuration)}s</td>
                <td>${claim.minDuration}s</td>
                <td>${claim.maxDuration}s</td>
                <td>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <span class="stat-value">${Math.round(claim.avgDuration)}</span>
                      <span class="stat-label">Avg</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-value">${claim.minDuration}</span>
                      <span class="stat-label">Best</span>
                    </div>
                    <div class="stat-item">
                      <span class="stat-value">${claim.maxDuration}</span>
                      <span class="stat-label">Longest</span>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    ` : `
    <div class="metrics-section">
      <div class="section-header">
        <h3>🏷️ Claim Type Performance</h3>
      </div>
      <div class="section-content">
        <div class="no-data">No claim data available</div>
      </div>
    </div>
    `}
  `;

  metricsContent.innerHTML = html;
}

function showError(message) {
  userTitle.textContent = 'Error';
  userSubtitle.textContent = message;
  metricsContent.innerHTML = `<div class="no-data">${message}</div>`;
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today at ' + date.toLocaleTimeString();
  } else if (diffDays === 1) {
    return 'Yesterday at ' + date.toLocaleTimeString();
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}