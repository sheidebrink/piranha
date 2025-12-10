// Global error handler for main renderer
window.addEventListener('error', (event) => {
  console.error('=== MAIN RENDERER ERROR ===');
  console.error('Message:', event.message);
  console.error('Filename:', event.filename);
  console.error('Line:', event.lineno, 'Column:', event.colno);
  console.error('Error object:', event.error);
  console.error('Stack:', event.error?.stack);
  console.error('===========================');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('=== UNHANDLED PROMISE REJECTION (MAIN) ===');
  console.error('Reason:', event.reason);
  console.error('Promise:', event.promise);
  console.error('==========================================');
});

console.log('Main renderer initializing...');

const tabs = document.getElementById('tabs');
const sessionStats = document.getElementById('sessionStats');
const toastContainer = document.getElementById('toastContainer');
const envIndicator = document.getElementById('envIndicator');
const apiStatus = document.getElementById('apiStatus');
const userIndicator = document.getElementById('userIndicator');
const versionIndicator = document.getElementById('versionIndicator');

console.log('Main renderer elements:', {
  tabs: !!tabs,
  sessionStats: !!sessionStats,
  toastContainer: !!toastContainer,
  envIndicator: !!envIndicator,
  apiStatus: !!apiStatus,
  userIndicator: !!userIndicator,
  versionIndicator: !!versionIndicator
});

// Load and display settings
if (window.electronAPI && window.electronAPI.getSettings) {
  window.electronAPI.getSettings().then(settings => {
    const env = settings.environments[settings.environment];
    if (envIndicator) {
      envIndicator.textContent = `${env.name} Environment`;
      envIndicator.style.color = env.color;
    }
    if (versionIndicator) {
      versionIndicator.textContent = `v${settings.version}`;
    }
  }).catch(error => {
    console.error('Failed to get settings:', error);
    if (envIndicator) envIndicator.textContent = 'Environment: Unknown';
    if (versionIndicator) versionIndicator.textContent = 'v1.0.0';
  });
} else {
  console.log('electronAPI.getSettings not available yet');
}

// Load and display user info
if (window.electronAPI && window.electronAPI.getUserInfo) {
  window.electronAPI.getUserInfo().then(userInfo => {
    if (userIndicator) {
      userIndicator.textContent = userInfo.username;
    }
  }).catch(error => {
    console.error('Failed to get user info:', error);
    if (userIndicator) userIndicator.textContent = 'Unknown User';
  });
}

function updateApiStatus(connected) {
  if (apiStatus) {
    if (connected) {
      apiStatus.textContent = 'API Connected';
      apiStatus.className = 'api-status connected';
    } else {
      apiStatus.textContent = 'API Offline';
      apiStatus.className = 'api-status disconnected';
    }
  }
}

// Listen for API status
if (window.electronAPI && window.electronAPI.onApiStatus) {
  window.electronAPI.onApiStatus((status) => {
    updateApiStatus(status.connected);
    if (!status.connected) {
      showToast(
        '⚠️ API Unavailable',
        status.message,
        'warning'
      );
    }
  });
  
  // Get initial API status
  if (window.electronAPI.getApiStatus) {
    window.electronAPI.getApiStatus().then(status => {
      updateApiStatus(status.connected);
    }).catch(() => {
      updateApiStatus(false);
    });
  }
} else {
  console.error('electronAPI.onApiStatus not available');
  updateApiStatus(false);
}

// Top-level tab management (Email and Web Container)
if (window.electronAPI && window.electronAPI.onTabsUpdated) {
  window.electronAPI.onTabsUpdated((tabList) => {
    console.log('Received tabs update in renderer:', tabList);
    renderTabs(tabList);
  });
} else {
  console.error('electronAPI.onTabsUpdated not available');
}

function renderTabs(tabList) {
  console.log('Rendering tabs:', tabList);
  tabs.innerHTML = tabList.map(tab => `
    <div class="tab ${tab.active ? 'active' : ''}" data-tab-id="${tab.id}">
      <span class="tab-title">${tab.title}</span>
    </div>
  `).join('');

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
      const tabId = parseInt(el.dataset.tabId);
      console.log('Switching to tab:', tabId);
      window.electronAPI.switchTab(tabId);
    });
  });
}

// Toast notification system

function showToast(title, message, type = 'info', onClick = null) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    info: '📧',
    warning: '⚠️',
    error: '❌'
  };
  
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || '📧'}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">×</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Close button
  toast.querySelector('.toast-close').addEventListener('click', (e) => {
    e.stopPropagation();
    removeToast(toast);
  });
  
  // Click action
  if (onClick) {
    toast.addEventListener('click', () => {
      onClick();
      removeToast(toast);
    });
  }
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    removeToast(toast);
  }, 5000);
}

function removeToast(toast) {
  toast.style.animation = 'slideOut 0.3s ease-out';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// Claim info is now handled in web-container.js

// Listen for email search results
if (window.electronAPI && window.electronAPI.onEmailSearchResult) {
  window.electronAPI.onEmailSearchResult((result) => {
    const { claimNumber, emailCount } = result;
    
    if (emailCount > 0) {
      showToast(
        `📧 ${emailCount} Email${emailCount > 1 ? 's' : ''} Found`,
        `Found ${emailCount} email${emailCount > 1 ? 's' : ''} related to claim ${claimNumber}. Click to view.`,
        'info',
        () => {
          window.electronAPI.openEmailTab();
          // Send search query to email tab
          setTimeout(() => {
            // The email tab will handle the search
          }, 100);
        }
      );
    } else {
      showToast(
        '📧 No Emails Found',
        `No emails found for claim ${claimNumber}.`,
        'warning'
      );
    }
  });
}

// All web controls moved to web-container.js

// Update session stats periodically
async function updateSessionStats() {
  try {
    if (window.electronAPI && window.electronAPI.getSessionSummary) {
      const summary = await window.electronAPI.getSessionSummary();
      const claims = summary.claims_processed || 0;
      const avgMinutes = Math.round((summary.avg_claim_duration || 0) / 60);
      if (sessionStats) {
        sessionStats.textContent = `Session: ${claims} claims | Avg: ${avgMinutes}m`;
      }
    }
  } catch (error) {
    console.error('Error updating session stats:', error);
  }
}

setInterval(updateSessionStats, 5000);
// Delay first update to ensure electronAPI is ready
setTimeout(updateSessionStats, 1000);
