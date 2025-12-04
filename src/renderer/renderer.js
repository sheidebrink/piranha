const tabs = document.getElementById('tabs');
const sessionStats = document.getElementById('sessionStats');
const toastContainer = document.getElementById('toastContainer');
const envIndicator = document.getElementById('envIndicator');
const versionIndicator = document.getElementById('versionIndicator');

// Load and display settings
window.electronAPI.getSettings().then(settings => {
  const env = settings.environments[settings.environment];
  envIndicator.textContent = `${env.name} Environment`;
  envIndicator.style.color = env.color;
  versionIndicator.textContent = `v${settings.version}`;
});

// Top-level tab management (Email and Web Container)
window.electronAPI.onTabsUpdated((tabList) => {
  console.log('Received tabs update in renderer:', tabList);
  renderTabs(tabList);
});

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

// All web controls moved to web-container.js

// Update session stats periodically
async function updateSessionStats() {
  const summary = await window.electronAPI.getSessionSummary();
  const claims = summary.claims_processed || 0;
  const avgMinutes = Math.round((summary.avg_claim_duration || 0) / 60);
  sessionStats.textContent = `Session: ${claims} claims | Avg: ${avgMinutes}m`;
}

setInterval(updateSessionStats, 5000);
updateSessionStats();
