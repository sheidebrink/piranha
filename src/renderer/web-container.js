const toggleToolbarBtn = document.getElementById('toggleToolbarBtn');
const webToolbar = document.getElementById('webToolbar');
const urlInput = document.getElementById('urlInput');
const loadBtn = document.getElementById('loadBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevel = document.getElementById('zoomLevel');
const breadcrumbs = document.getElementById('breadcrumbs');
const webTabs = document.getElementById('webTabs');
const newWebTabBtn = document.getElementById('newWebTabBtn');
const currentClaim = document.getElementById('currentClaim');

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
  }
});

urlInput.addEventListener('keypress', async (e) => {
  if (e.key === 'Enter') {
    const url = urlInput.value.trim();
    if (url) {
      await window.electronAPI.loadUrl(url);
    }
  }
});

// Navigation history removed - back/forward buttons removed

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

// Metrics modal removed - metrics is now a top-level tab
