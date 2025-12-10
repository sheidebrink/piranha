const { ipcRenderer } = require('electron');

let USER_EMAIL = 'mhuss@cbcsclaims.com'; // Default fallback

// Get user email from main process
window.electronAPI.getUserInfo().then(userInfo => {
    // This will be updated when we add user email to getUserInfo
    USER_EMAIL = userInfo.email || USER_EMAIL;
}).catch(() => {
    console.log('Using default email');
});
let currentFolder = 'inbox';
let selectedEmailId = null;

// DOM elements
const emailListContent = document.getElementById('emailListContent');
const emailDetailContent = document.getElementById('emailDetailContent');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');
const folderTitle = document.getElementById('folderTitle');
const emailCount = document.getElementById('emailCount');
const filterNeedsReply = document.getElementById('filterNeedsReply');

let allEmails = [];
let filterActive = false;

// Load emails on startup
loadEmails();

// Listen for search requests from main process
ipcRenderer.on('search-emails-for-claim', (event, claimNumber) => {
  console.log('Searching for claim:', claimNumber);
  searchInput.value = claimNumber;
  searchEmails(claimNumber);
});

// Filter toggle
filterNeedsReply.addEventListener('change', (e) => {
  filterActive = e.target.checked;
  if (filterActive) {
    const needsReplyEmails = allEmails.filter(email => 
      !email.isReplied && email.from.emailAddress.address !== USER_EMAIL
    );
    renderEmailList(needsReplyEmails);
    updateEmailCount(needsReplyEmails.length);
  } else {
    renderEmailList(allEmails);
    updateEmailCount(allEmails.length);
  }
});

// Refresh button
refreshBtn.addEventListener('click', () => {
  loadEmails();
});

// Search
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (e.target.value.trim()) {
      searchEmails(e.target.value.trim());
    } else {
      loadEmails();
    }
  }, 500);
});

// Folder selection
document.querySelectorAll('.folder').forEach(folder => {
  folder.addEventListener('click', () => {
    document.querySelectorAll('.folder').forEach(f => f.classList.remove('active'));
    folder.classList.add('active');
    currentFolder = folder.dataset.folder;
    folderTitle.textContent = folder.querySelector('.folder-name').textContent;
    loadEmails();
  });
});

async function loadEmails() {
  try {
    emailListContent.innerHTML = '<div class="loading">Loading emails...</div>';
    
    const emails = await ipcRenderer.invoke('get-emails', {
      userEmail: USER_EMAIL,
      folder: currentFolder,
      top: 50
    });

    allEmails = emails;
    
    if (filterActive) {
      const needsReplyEmails = emails.filter(email => 
        !email.isReplied && email.from.emailAddress.address !== USER_EMAIL
      );
      renderEmailList(needsReplyEmails);
      updateEmailCount(needsReplyEmails.length);
    } else {
      renderEmailList(emails);
      updateEmailCount(emails.length);
    }
  } catch (error) {
    console.error('Error loading emails:', error);
    emailListContent.innerHTML = '<div class="error">Failed to load emails. Please try again.</div>';
  }
}

async function searchEmails(query) {
  try {
    emailListContent.innerHTML = '<div class="loading">Searching...</div>';
    
    const emails = await ipcRenderer.invoke('search-emails', {
      userEmail: USER_EMAIL,
      query
    });

    renderEmailList(emails);
    updateEmailCount(emails.length);
  } catch (error) {
    console.error('Error searching emails:', error);
    emailListContent.innerHTML = '<div class="error">Search failed. Please try again.</div>';
  }
}

function renderEmailList(emails) {
  if (emails.length === 0) {
    emailListContent.innerHTML = '<div class="empty-state"><div>No emails found</div></div>';
    return;
  }

  emailListContent.innerHTML = emails.map(email => {
    const needsReply = !email.isReplied && email.from.emailAddress.address !== USER_EMAIL;
    const classes = [
      'email-item',
      email.isRead ? '' : 'unread',
      needsReply ? 'needs-reply' : ''
    ].filter(Boolean).join(' ');
    
    return `
      <div class="${classes}" data-id="${email.id}">
        <div class="email-from">
          ${email.from.emailAddress.name || email.from.emailAddress.address}
          ${needsReply ? '<span class="reply-indicator" title="Needs Reply">⚠️</span>' : ''}
        </div>
        <div class="email-subject">${email.subject || '(No subject)'}</div>
        <div class="email-preview">${email.bodyPreview || ''}</div>
        <div class="email-time">${formatDate(email.receivedDateTime)}</div>
      </div>
    `;
  }).join('');

  // Add click handlers
  document.querySelectorAll('.email-item').forEach(item => {
    item.addEventListener('click', () => {
      selectEmail(item.dataset.id);
    });
  });
}

async function selectEmail(emailId) {
  try {
    // Update UI
    document.querySelectorAll('.email-item').forEach(item => {
      item.classList.remove('selected');
    });
    document.querySelector(`[data-id="${emailId}"]`).classList.add('selected');

    selectedEmailId = emailId;
    emailDetailContent.innerHTML = '<div class="loading">Loading email...</div>';

    // Fetch full email
    const email = await ipcRenderer.invoke('get-email-body', {
      userEmail: USER_EMAIL,
      messageId: emailId
    });

    renderEmailDetail(email);

    // Mark as read
    if (!email.isRead) {
      await ipcRenderer.invoke('mark-email-read', {
        userEmail: USER_EMAIL,
        messageId: emailId
      });
      
      // Update list item
      const listItem = document.querySelector(`[data-id="${emailId}"]`);
      if (listItem) {
        listItem.classList.remove('unread');
      }
    }
  } catch (error) {
    console.error('Error loading email:', error);
    emailDetailContent.innerHTML = '<div class="error">Failed to load email.</div>';
  }
}

function renderEmailDetail(email) {
  const fromName = email.from.emailAddress.name || email.from.emailAddress.address;
  const toList = email.toRecipients.map(r => r.emailAddress.name || r.emailAddress.address).join(', ');
  
  emailDetailContent.innerHTML = `
    <div class="email-detail-header">
      <div class="email-detail-subject">${email.subject || '(No subject)'}</div>
      <div class="email-detail-meta">
        <div><strong>From:</strong> ${fromName} &lt;${email.from.emailAddress.address}&gt;</div>
        <div><strong>To:</strong> ${toList}</div>
        <div><strong>Date:</strong> ${formatDateTime(email.receivedDateTime)}</div>
      </div>
    </div>
    <div class="email-detail-body">
      ${email.body.content}
    </div>
  `;
}

function updateEmailCount(count) {
  emailCount.textContent = `${count} emails`;
  
  if (currentFolder === 'inbox') {
    const unreadCount = document.querySelectorAll('.email-item.unread').length;
    document.getElementById('inboxCount').textContent = unreadCount;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function formatDateTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}
