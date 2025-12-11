let users = [];
let editingUser = null;

// DOM elements
const usersTable = document.getElementById('usersTable');
const refreshBtn = document.getElementById('refreshBtn');
const editModal = document.getElementById('editModal');
const editUserForm = document.getElementById('editUserForm');
const closeModal = document.getElementById('closeModal');
const cancelEdit = document.getElementById('cancelEdit');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, initializing admin panel');
  console.log('editModal element found:', !!document.getElementById('editModal'));
  console.log('editUserForm element found:', !!document.getElementById('editUserForm'));
  
  loadUsers();
  setupEventListeners();
});

function setupEventListeners() {
  refreshBtn.addEventListener('click', loadUsers);
  closeModal.addEventListener('click', hideEditModal);
  cancelEdit.addEventListener('click', hideEditModal);
  editUserForm.addEventListener('submit', handleSaveUser);
  
  // Close modal on background click
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) {
      hideEditModal();
    }
  });
}

function setupUserActionListeners() {
  // Use event delegation for dynamically created buttons
  const editButtons = document.querySelectorAll('.edit-btn');
  const deleteButtons = document.querySelectorAll('.delete-btn');
  
  editButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const userId = parseInt(e.target.getAttribute('data-user-id'));
      console.log('Edit button clicked for user:', userId);
      editUser(userId);
    });
  });
  
  deleteButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      const userId = parseInt(e.target.getAttribute('data-user-id'));
      console.log('Delete button clicked for user:', userId);
      deleteUser(userId);
    });
  });
}

async function loadUsers() {
  try {
    usersTable.innerHTML = '<div class="loading">Loading users...</div>';
    
    const userData = await window.electronAPI.getAllUsers();
    if (userData && Array.isArray(userData)) {
      users = userData;
      renderUsers();
    } else {
      usersTable.innerHTML = '<div class="loading">No users found or API unavailable</div>';
    }
  } catch (error) {
    console.error('Failed to load users:', error);
    usersTable.innerHTML = '<div class="loading">Error loading users</div>';
  }
}

function renderUsers() {
  if (users.length === 0) {
    usersTable.innerHTML = '<div class="loading">No users found</div>';
    return;
  }

  const html = `
    <div class="user-header">
      <div>Username</div>
      <div>Email</div>
      <div>Role</div>
      <div>Last Login</div>
      <div>Actions</div>
    </div>
    ${users.map(user => `
      <div class="user-row">
        <div class="username">${escapeHtml(user.username)}</div>
        <div class="email">${escapeHtml(user.email)}</div>
        <div>
          <span class="admin-badge ${user.isAdmin ? 'admin' : 'user'}">
            ${user.isAdmin ? 'Admin' : 'User'}
          </span>
        </div>
        <div class="last-login">
          ${user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
        </div>
        <div class="actions">
          <button class="btn btn-primary btn-small edit-btn" data-user-id="${user.id}">
            Edit
          </button>
          <button class="btn btn-danger btn-small delete-btn" data-user-id="${user.id}">
            Delete
          </button>
        </div>
      </div>
    `).join('')}
  `;

  usersTable.innerHTML = html;
  
  // Add event listeners for edit and delete buttons
  setupUserActionListeners();
}

function editUser(userId) {
  console.log('Edit user clicked:', userId);
  const user = users.find(u => u.id === userId);
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  console.log('Found user:', user);
  editingUser = user;
  
  // Populate form
  document.getElementById('editUserId').value = user.id;
  document.getElementById('editUsername').value = user.username;
  document.getElementById('editEmail').value = user.email;
  document.getElementById('editIsAdmin').checked = user.isAdmin;
  
  console.log('Showing edit modal');
  showEditModal();
}

// No longer need global assignments since we're using proper event listeners

function showEditModal() {
  console.log('showEditModal called');
  console.log('editModal element:', editModal);
  console.log('editModal classes before:', editModal.className);
  
  if (!editModal) {
    console.error('editModal element not found!');
    return;
  }
  
  editModal.classList.remove('hidden');
  console.log('editModal classes after:', editModal.className);
  console.log('editModal style display:', window.getComputedStyle(editModal).display);
}

function hideEditModal() {
  editModal.classList.add('hidden');
  editingUser = null;
  editUserForm.reset();
}

async function handleSaveUser(e) {
  e.preventDefault();
  
  if (!editingUser) return;
  
  const emailValue = document.getElementById('editEmail').value;
  const isAdminValue = document.getElementById('editIsAdmin').checked;
  
  const userData = {
    email: emailValue,
    isAdmin: isAdminValue
  };
  
  console.log('Attempting to save user:', editingUser.id);
  console.log('Original user data:', editingUser);
  console.log('New user data:', userData);
  
  try {
    // Disable form
    const submitBtn = editUserForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    console.log('Calling updateUser API...');
    const result = await window.electronAPI.updateUser(editingUser.id, userData);
    console.log('API response:', result);
    
    if (result) {
      // Update local user data
      const userIndex = users.findIndex(u => u.id === editingUser.id);
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], email: userData.email, isAdmin: userData.isAdmin };
        console.log('Updated local user data:', users[userIndex]);
      }
      
      renderUsers();
      hideEditModal();
      
      // Show success message
      showNotification('User updated successfully', 'success');
    } else {
      console.error('API returned null/false result');
      showNotification('Failed to update user - API returned no result', 'error');
    }
  } catch (error) {
    console.error('Error updating user:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    showNotification(`Error updating user: ${error.message}`, 'error');
  } finally {
    // Re-enable form
    const submitBtn = editUserForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Changes';
  }
}

function formatDate(dateString) {
  if (!dateString) return 'Never';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function deleteUser(userId) {
  console.log('Delete user clicked:', userId);
  const user = users.find(u => u.id === userId);
  if (!user) {
    console.error('User not found:', userId);
    return;
  }

  // Confirm deletion
  const confirmed = confirm(`Are you sure you want to delete user "${user.username}"?\n\nThis action cannot be undone.`);
  if (!confirmed) return;

  try {
    console.log('Calling deleteUser API for user:', userId);
    const result = await window.electronAPI.deleteUser(userId);
    console.log('Delete result:', result);
    
    if (result) {
      // Remove user from local array
      users = users.filter(u => u.id !== userId);
      renderUsers();
      showNotification('User deleted successfully', 'success');
    } else {
      showNotification('Failed to delete user', 'error');
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    showNotification('Error deleting user', 'error');
  }
}

// No longer need global assignments since we're using proper event listeners

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Style the notification
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '12px 20px',
    borderRadius: '4px',
    color: 'white',
    fontWeight: '600',
    zIndex: '10000',
    transform: 'translateX(400px)',
    transition: 'transform 0.3s ease-out'
  });
  
  if (type === 'success') {
    notification.style.background = '#27ae60';
  } else if (type === 'error') {
    notification.style.background = '#e74c3c';
  } else {
    notification.style.background = '#3498db';
  }
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}