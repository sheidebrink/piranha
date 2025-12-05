// Global error handler for web-container
window.addEventListener('error', (event) => {
  console.error('=== WEB CONTAINER ERROR ===');
  console.error('Message:', event.message);
  console.error('Filename:', event.filename);
  console.error('Line:', event.lineno, 'Column:', event.colno);
  console.error('Error object:', event.error);
  console.error('Stack:', event.error?.stack);
  console.error('=========================');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Reason:', event.reason);
  console.error('Promise:', event.promise);
  console.error('===================================');
});

console.log('Web container initializing...');

const toggleToolbarBtn = document.getElementById('toggleToolbarBtn');
const webToolbar = document.getElementById('webToolbar');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomResetBtn = document.getElementById('zoomResetBtn');
const zoomLevel = document.getElementById('zoomLevel');
const webTabs = document.getElementById('webTabs');
const newWebTabBtn = document.getElementById('newWebTabBtn');
const currentClaim = document.getElementById('currentClaim');

console.log('Web container elements:', {
  toggleToolbarBtn: !!toggleToolbarBtn,
  webToolbar: !!webToolbar,
  zoomInBtn: !!zoomInBtn,
  zoomOutBtn: !!zoomOutBtn,
  zoomResetBtn: !!zoomResetBtn,
  zoomLevel: !!zoomLevel,
  webTabs: !!webTabs,
  newWebTabBtn: !!newWebTabBtn,
  currentClaim: !!currentClaim
});

let toolbarVisible = false;

// Toggle toolbar visibility
if (toggleToolbarBtn) {
  toggleToolbarBtn.addEventListener('click', () => {
    toolbarVisible = !toolbarVisible;
    if (toolbarVisible) {
      webToolbar.classList.remove('hidden');
      toggleToolbarBtn.textContent = '✕';
      toggleToolbarBtn.title = 'Hide Toolbar';
    } else {
      webToolbar.classList.add('hidden');
      toggleToolbarBtn.textContent = '⚙️';
      toggleToolbarBtn.title = 'Show Toolbar';
    }
  });
} else {
  console.error('toggleToolbarBtn not found');
}

let currentZoom = 1.0;
let navigationHistory = [];
let currentIndex = -1;

// Tab management for nested web tabs
console.log('Setting up web tabs listener...');
console.log('electronAPI available:', !!window.electronAPI);
console.log('onWebTabsUpdated available:', !!(window.electronAPI?.onWebTabsUpdated));

if (window.electronAPI && window.electronAPI.onWebTabsUpdated) {
  console.log('Registering onWebTabsUpdated listener');
  window.electronAPI.onWebTabsUpdated((tabList) => {
    console.log('onWebTabsUpdated called with:', tabList);
    try {
      renderWebTabs(tabList);
    } catch (error) {
      console.error('=== ERROR IN renderWebTabs ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      console.error('TabList:', tabList);
      console.error('==============================');
    }
  });
} else {
  console.error('electronAPI.onWebTabsUpdated not available');
  console.error('window.electronAPI:', window.electronAPI);
}

function renderWebTabs(tabList) {
  console.log('renderWebTabs called');
  console.log('webTabs element:', webTabs);
  console.log('tabList:', tabList);
  
  if (!webTabs) {
    console.error('webTabs element not found!');
    return;
  }
  
  if (!Array.isArray(tabList)) {
    console.error('tabList is not an array:', typeof tabList, tabList);
    return;
  }
  
  try {
    webTabs.innerHTML = tabList.map(tab => `
      <div class="web-tab ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
        <span class="web-tab-title">${tab.title}</span>
        ${tab.closable !== false ? `<button class="web-tab-close" data-tab-id="${tab.id}" title="Close tab">×</button>` : ''}
      </div>
    `).join('');
    
    console.log('Web tabs HTML updated');

    // Add click handlers
    document.querySelectorAll('.web-tab').forEach(el => {
      el.addEventListener('click', (e) => {
        if (!e.target.classList.contains('web-tab-close')) {
          const tabId = parseInt(el.dataset.tabId);
          console.log('Switching to web tab:', tabId);
          window.electronAPI.switchWebTab(tabId);
        }
      });
    });

    document.querySelectorAll('.web-tab-close').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabId = parseInt(el.dataset.tabId);
        console.log('Closing web tab:', tabId);
        window.electronAPI.closeWebTab(tabId);
      });
    });
    
    console.log('Web tab click handlers attached');
  } catch (error) {
    console.error('=== ERROR IN renderWebTabs inner try ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('==========================================');
    throw error;
  }
}

// Get settings from main process
let appSettings = null;
if (window.electronAPI && window.electronAPI.getSettings) {
  window.electronAPI.getSettings().then(settings => {
    appSettings = settings;
  }).catch(error => {
    console.error('Failed to get settings:', error);
  });
}

if (newWebTabBtn) {
  newWebTabBtn.addEventListener('click', () => {
    try {
      if (appSettings && window.electronAPI && window.electronAPI.createWebTab) {
        const env = appSettings.environments[appSettings.environment];
        window.electronAPI.createWebTab(env.url);
      } else {
        console.error('Cannot create web tab: missing settings or API');
      }
    } catch (error) {
      console.error('Error creating web tab:', error);
    }
  });
} else {
  console.error('newWebTabBtn not found');
}

// URL input removed - using settings file for environment URLs

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
if (zoomInBtn) {
  zoomInBtn.addEventListener('click', () => {
    currentZoom = Math.min(currentZoom + 0.1, 3.0);
    updateZoom();
  });
}

if (zoomOutBtn) {
  zoomOutBtn.addEventListener('click', () => {
    currentZoom = Math.max(currentZoom - 0.1, 0.5);
    updateZoom();
  });
}

if (zoomResetBtn) {
  zoomResetBtn.addEventListener('click', () => {
    currentZoom = 1.0;
    updateZoom();
  });
}

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
if (window.electronAPI && window.electronAPI.onClaimInfoUpdated) {
  window.electronAPI.onClaimInfoUpdated((claimInfo) => {
    currentClaim.textContent = `${claimInfo.claimantName} - Claim #${claimInfo.claimId}`;
    currentClaim.classList.add('visible');
  });
} else {
  console.error('electronAPI.onClaimInfoUpdated not available');
}

// Metrics modal removed - metrics is now a top-level tab
