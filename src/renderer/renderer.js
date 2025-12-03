const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const metricsBtn = document.getElementById('metricsBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const clearSessionBtn = document.getElementById('clearSessionBtn');
const emailBtn = document.getElementById('emailBtn');
const sessionStats = document.getElementById('sessionStats');
const currentClaim = document.getElementById('currentClaim');
const metricsModal = document.getElementById('metricsModal');
const closeModal = document.querySelector('.close');
const breadcrumbs = document.getElementById('breadcrumbs');
const tabs = document.getElementById('tabs');
const newTabBtn = document.getElementById('newTabBtn');

// Tab management
window.electronAPI.onTabsUpdated((tabList) => {
  renderTabs(tabList);
});

function renderTabs(tabList) {
  tabs.innerHTML = tabList.map(tab => `
    <div class="tab ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
      <span class="tab-title">${tab.title}</span>
      ${tab.closable !== false ? `<button class="tab-close" data-tab-id="${tab.id}" title="Close tab">×</button>` : ''}
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!e.target.classList.contains('tab-close')) {
        const tabId = parseInt(el.dataset.tabId);
        window.electronAPI.switchTab(tabId);
      }
    });
  });

  document.querySelectorAll('.tab-close').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = parseInt(el.dataset.tabId);
      window.electronAPI.closeTab(tabId);
    });
  });
}

newTabBtn.addEventListener('click', () => {
  window.electronAPI.createTab('https://test-cbcs.ventivclient.com/ivos/login.jsp');
});

// Listen for claim info updates
window.electronAPI.onClaimInfoUpdated((claimInfo) => {
  currentClaim.textContent = `${claimInfo.claimantName} - Claim #${claimInfo.claimId}`;
  currentClaim.style.display = 'block';
});

// Clear session button
clearSessionBtn.addEventListener('click', async () => {
  if (confirm('Clear all cookies and session data? You will need to log in again.')) {
    await window.electronAPI.clearSession();
    alert('Session cleared. Reloading...');
    location.reload();
  }
});

// Email button
emailBtn.addEventListener('click', async () => {
  await window.electronAPI.openEmailTab();
});

let navigationHistory = [];
let currentIndex = -1;

// Don't auto-load - tabs are created by main process now
// window.addEventListener('DOMContentLoaded', () => {
//   const defaultUrl = urlInput.value;
//   if (defaultUrl) {
//     window.electronAPI.loadUrl(defaultUrl);
//     addToHistory(defaultUrl);
//   }
// });

// Load URL into BrowserView
loadBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (url) {
    await window.electronAPI.loadUrl(url);
    addToHistory(url);
  }
});

urlInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const url = urlInput.value.trim();
    if (url) {
      await window.electronAPI.loadUrl(url);
      addToHistory(url);
    }
  }
});

// Navigation buttons
backBtn.addEventListener('click', () => {
  if (currentIndex > 0) {
    currentIndex--;
    const url = navigationHistory[currentIndex];
    window.electronAPI.loadUrl(url);
    updateBreadcrumbs();
  }
});

forwardBtn.addEventListener('click', () => {
  if (currentIndex < navigationHistory.length - 1) {
    currentIndex++;
    const url = navigationHistory[currentIndex];
    window.electronAPI.loadUrl(url);
    updateBreadcrumbs();
  }
});

function addToHistory(url) {
  // Remove any forward history if we're navigating from middle
  if (currentIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, currentIndex + 1);
  }
  navigationHistory.push(url);
  currentIndex = navigationHistory.length - 1;
  updateBreadcrumbs();
}

function updateBreadcrumbs() {
  const maxBreadcrumbs = 5;
  const start = Math.max(0, currentIndex - maxBreadcrumbs + 1);
  const visible = navigationHistory.slice(start, currentIndex + 1);
  
  breadcrumbs.innerHTML = visible.map((url, idx) => {
    const actualIdx = start + idx;
    const isActive = actualIdx === currentIndex;
    const label = extractLabel(url);
    return `<span class="breadcrumb ${isActive ? 'active' : ''}" data-index="${actualIdx}">${label}</span>`;
  }).join(' › ');
  
  // Add click handlers
  document.querySelectorAll('.breadcrumb').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.index);
      currentIndex = idx;
      window.electronAPI.loadUrl(navigationHistory[idx]);
      updateBreadcrumbs();
    });
  });
  
  backBtn.disabled = currentIndex <= 0;
  forwardBtn.disabled = currentIndex >= navigationHistory.length - 1;
}

function extractLabel(url) {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.split('/').filter(Boolean);
    return path[path.length - 1] || urlObj.hostname;
  } catch {
    return url.substring(0, 20) + '...';
  }
}

// Show metrics modal
metricsBtn.addEventListener('click', async () => {
  const summary = await window.electronAPI.getSessionSummary();
  const metrics = await window.electronAPI.getMetrics({});
  
  let html = '<div class="metric-row">';
  html += '<div class="metric-label">Current Session</div>';
  html += `<div class="metric-value">${summary.claims_processed || 0} claims processed</div>`;
  html += `<div>Avg Duration: ${formatDuration(summary.avg_claim_duration)}</div>`;
  html += `<div>Total Time: ${formatDuration(summary.total_time_seconds)}</div>`;
  html += '</div>';
  
  if (metrics && metrics.length > 0) {
    html += '<h3 style="margin-top: 20px;">By Claim Type</h3>';
    metrics.forEach(m => {
      html += '<div class="metric-row">';
      html += `<div class="metric-label">${m.claim_type || 'Unknown'}</div>`;
      html += `<div>Total: ${m.total_claims}</div>`;
      html += `<div>Avg: ${formatDuration(m.avg_duration)}</div>`;
      html += `<div>Min: ${formatDuration(m.min_duration)} | Max: ${formatDuration(m.max_duration)}</div>`;
      html += '</div>';
    });
  }
  
  document.getElementById('metricsContent').innerHTML = html;
  
  // Hide BrowserView so modal is visible
  console.log('Hiding BrowserView...');
  await window.electronAPI.hideBrowserView();
  
  // Small delay to ensure BrowserView is removed
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('BrowserView hidden, showing modal...');
  metricsModal.classList.remove('hidden');
  metricsModal.style.display = 'block';
  console.log('Modal should be visible now');
});

closeModal.addEventListener('click', () => {
  console.log('Closing modal...');
  metricsModal.classList.add('hidden');
  metricsModal.style.display = 'none';
  window.electronAPI.showBrowserView();
});

window.addEventListener('click', (e) => {
  if (e.target === metricsModal) {
    console.log('Clicked outside modal, closing...');
    metricsModal.classList.add('hidden');
    metricsModal.style.display = 'none';
    window.electronAPI.showBrowserView();
  }
});

// Close modal with Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !metricsModal.classList.contains('hidden')) {
    console.log('Escape pressed, closing modal...');
    metricsModal.classList.add('hidden');
    metricsModal.style.display = 'none';
    window.electronAPI.showBrowserView();
  }
});

// Update session stats periodically
async function updateSessionStats() {
  const summary = await window.electronAPI.getSessionSummary();
  const claims = summary.claims_processed || 0;
  const avgMinutes = Math.round((summary.avg_claim_duration || 0) / 60);
  sessionStats.textContent = `Session: ${claims} claims | Avg: ${avgMinutes}m`;
}

setInterval(updateSessionStats, 5000);
updateSessionStats();

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
