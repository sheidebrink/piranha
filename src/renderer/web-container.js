const toggleToolbarBtn = document.getElementById('toggleToolbarBtn');
const webToolbar = document.getElementById('webToolbar');
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const metricsBtn = document.getElementById('metricsBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevel = document.getElementById('zoomLevel');
const breadcrumbs = document.getElementById('breadcrumbs');
const webTabs = document.getElementById('webTabs');
const newWebTabBtn = document.getElementById('newWebTabBtn');
const currentClaim = document.getElementById('currentClaim');
const metricsModal = document.getElementById('metricsModal');
const closeModal = document.querySelector('.close');

let toolbarVisible = false;

// Toggle toolbar visibility
toggleToolbarBtn.addEventListener('click', () => {
  toolbarVisible = !toolbarVisible;
  if (toolbarVisible) {
    webToolbar.classList.remove('hidden');
    breadcrumbs.classList.remove('hidden');
    toggleToolbarBtn.textContent = '✕';
    toggleToolbarBtn.title = 'Hide Toolbar';
  } else {
    webToolbar.classList.add('hidden');
    breadcrumbs.classList.add('hidden');
    toggleToolbarBtn.textContent = '⚙️';
    toggleToolbarBtn.title = 'Show Toolbar';
  }
});

let currentZoom = 1.0;
let navigationHistory = [];
let currentIndex = -1;

// Tab management for nested web tabs
window.electronAPI.onWebTabsUpdated((tabList) => {
  renderWebTabs(tabList);
});

function renderWebTabs(tabList) {
  webTabs.innerHTML = tabList.map(tab => `
    <div class="web-tab ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
      <span class="web-tab-title">${tab.title}</span>
      ${tab.closable !== false ? `<button class="web-tab-close" data-tab-id="${tab.id}" title="Close tab">×</button>` : ''}
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.web-tab').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!e.target.classList.contains('web-tab-close')) {
        const tabId = parseInt(el.dataset.tabId);
        window.electronAPI.switchWebTab(tabId);
      }
    });
  });

  document.querySelectorAll('.web-tab-close').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabId = parseInt(el.dataset.tabId);
      window.electronAPI.closeWebTab(tabId);
    });
  });
}

newWebTabBtn.addEventListener('click', () => {
  window.electronAPI.createWebTab('https://test-cbcs.ventivclient.com/ivos/login.jsp');
});

// Load URL
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

// Navigation
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

// Zoom controls
zoomInBtn.addEventListener('click', () => {
  currentZoom = Math.min(currentZoom + 0.1, 3.0);
  updateZoom();
});

zoomOutBtn.addEventListener('click', () => {
  currentZoom = Math.max(currentZoom - 0.1, 0.5);
  updateZoom();
});

zoomResetBtn.addEventListener('click', () => {
  currentZoom = 1.0;
  updateZoom();
});

function updateZoom() {
  window.electronAPI.setZoom(currentZoom);
  zoomLevel.textContent = Math.round(currentZoom * 100) + '%';
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      currentZoom = Math.min(currentZoom + 0.1, 3.0);
      updateZoom();
    } else if (e.key === '-') {
      e.preventDefault();
      currentZoom = Math.max(currentZoom - 0.1, 0.5);
      updateZoom();
    } else if (e.key === '0') {
      e.preventDefault();
      currentZoom = 1.0;
      updateZoom();
    }
  }
});

// Claim info updates
window.electronAPI.onClaimInfoUpdated((claimInfo) => {
  currentClaim.textContent = `${claimInfo.claimantName} - Claim #${claimInfo.claimId}`;
  currentClaim.classList.add('visible');
});

// Metrics modal
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
  metricsModal.classList.remove('hidden');
  metricsModal.style.display = 'block';
});

closeModal.addEventListener('click', () => {
  metricsModal.classList.add('hidden');
  metricsModal.style.display = 'none';
});

window.addEventListener('click', (e) => {
  if (e.target === metricsModal) {
    metricsModal.classList.add('hidden');
    metricsModal.style.display = 'none';
  }
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !metricsModal.classList.contains('hidden')) {
    metricsModal.classList.add('hidden');
    metricsModal.style.display = 'none';
  }
});

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
