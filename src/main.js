const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const MetricsTracker = require('./metrics/tracker');
const Database = require('./database/db');
const EmailService = require('./services/email-service');
const ApiService = require('./services/api-service');

// Load settings
const settingsPath = path.join(__dirname, '../config/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
const currentEnv = settings.environments[settings.environment];

let mainWindow;
let topLevelViews = new Map(); // Map of top-level tabId -> BrowserView (Email, Web Container)
let webTabs = new Map(); // Map of nested web tabId -> BrowserView (Claims tabs)
let activeTopLevelTabId = null;
let activeWebTabId = null;
let topLevelTabCounter = 0;
let webTabCounter = 0;
let metricsTracker;
let apiService;
let useApi = false; // Flag to determine if API is available
let db;
let emailService;
let emailTabId = null; // Top-level email tab
let webContainerTabId = null; // Top-level web container tab
let metricsTabId = null; // Top-level metrics tab
let adminTabId = null; // Top-level admin tab
let splashWindow = null;

// Window bounds management
function loadWindowBounds() {
    const fs = require('fs');
    const { screen } = require('electron');
    const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');

    try {
        if (fs.existsSync(boundsPath)) {
            const bounds = JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
            console.log('Loaded window bounds:', bounds);
            
            // Check if the window would be visible on any display
            if (bounds.x !== undefined && bounds.y !== undefined) {
                const displays = screen.getAllDisplays();
                const isVisible = displays.some(display => {
                    const { x, y, width, height } = display.bounds;
                    // Check if at least part of the window is on this display
                    return bounds.x < x + width && 
                           bounds.x + bounds.width > x &&
                           bounds.y < y + height && 
                           bounds.y + bounds.height > y;
                });
                
                if (!isVisible) {
                    console.log('Window would be off-screen, resetting position');
                    // Keep the size but reset position to primary display
                    return { 
                        width: bounds.width, 
                        height: bounds.height, 
                        x: undefined, 
                        y: undefined 
                    };
                }
            }
            
            return bounds;
        }
    } catch (e) {
        console.error('Failed to load window bounds:', e);
    }

    // Default bounds
    return { width: 1400, height: 900, x: undefined, y: undefined };
}

function saveWindowBounds() {
    if (!mainWindow) return;

    const fs = require('fs');
    const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');

    try {
        const bounds = mainWindow.getBounds();
        fs.writeFileSync(boundsPath, JSON.stringify(bounds, null, 2));
        console.log('Saved window bounds:', bounds);
    } catch (e) {
        console.error('Failed to save window bounds:', e);
    }
}

function createWindow() {
    // Load saved window bounds
    const windowBounds = loadWindowBounds();

    mainWindow = new BrowserWindow({
        width: windowBounds.width,
        height: windowBounds.height,
        x: windowBounds.x,
        y: windowBounds.y,
        title: 'Piranha - Claims Assistant',
        show: false, // Don't show until splash is done
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Load the control panel UI
    mainWindow.loadFile('src/renderer/index.html');

    // Open DevTools in a separate window for debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });

    // Wait for main window to be ready before creating tabs
    mainWindow.webContents.on('did-finish-load', () => {
        // Create top-level tabs
        createEmailTab(); // Email tab (top-level)
        createWebContainerTab(); // Web container tab (top-level, contains nested tabs)
        createMetricsTab(); // Metrics tab (top-level)

        // Switch to email tab first
        switchToTopLevelTab(emailTabId);
    });

    mainWindow.on('resize', () => {
        updateBrowserViewBounds();
    });

    // Save window position and size when moved or resized
    mainWindow.on('moved', saveWindowBounds);
    mainWindow.on('resized', saveWindowBounds);

    // Save on close
    mainWindow.on('close', saveWindowBounds);
}

function createSplashScreen() {
    // Load saved window bounds to determine which screen to show splash on
    const windowBounds = loadWindowBounds();

    splashWindow = new BrowserWindow({
        width: 500,
        height: 400,
        x: windowBounds.x,
        y: windowBounds.y,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile('src/renderer/splash.html');

    // Center on the screen where the main window will appear
    if (windowBounds.x !== undefined && windowBounds.y !== undefined) {
        const splashBounds = splashWindow.getBounds();
        splashWindow.setPosition(
            windowBounds.x + Math.floor((windowBounds.width - splashBounds.width) / 2),
            windowBounds.y + Math.floor((windowBounds.height - splashBounds.height) / 2)
        );
    } else {
        splashWindow.center();
    }
}

function closeSplashScreen() {
    if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
    }
}

app.whenReady().then(async () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║   🐟 PIRANHA - Claims Assistant 🐟   ║
    ║   Stay on top of what you do.        ║
    ╚═══════════════════════════════════════╝
    `);

    try {
        // Show splash screen
        createSplashScreen();
        console.log('✓ Splash screen created');

        // Try to connect to API
        console.log('Checking API connection...');
        apiService = new ApiService(settings.apiUrl);
        useApi = await apiService.checkConnection();
        console.log('✓ API check complete');

        if (useApi) {
            console.log('✅ Using API for metrics tracking');
            const os = require('os');
            const fullUsername = os.userInfo().username;
            // Extract just the username part (remove domain if present) and normalize to lowercase
            const rawUsername = fullUsername.includes('\\') ? fullUsername.split('\\')[1] : fullUsername;
            const username = rawUsername.toLowerCase();
            console.log('Full username:', fullUsername);
            console.log('Using username:', username);
            const sessionData = await apiService.startSession(username);
            if (sessionData) {
                console.log('✓ API session started');
                console.log('User email:', sessionData.userEmail);
                console.log('Is admin:', sessionData.isAdmin);
                console.log('Username:', username);
                
                // Store user info globally for email searches
                global.currentUserEmail = sessionData.userEmail;
                global.currentUserIsAdmin = sessionData.isAdmin;
                console.log('User is admin:', sessionData.isAdmin);
                
                // Always create admin tab (after main window is ready)
                // Delay admin tab creation until after main window is fully loaded
                setTimeout(() => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        createAdminTab();
                    }
                }, 1000);
            }
        } else {
            console.log('⚠️  API unavailable, using local database');
            db = new Database();
            console.log('✓ Database initialized');
            metricsTracker = new MetricsTracker(db);
            console.log('✓ Metrics tracker initialized');
            
            // Ensure current user exists in local database
            const os = require('os');
            const fullUsername = os.userInfo().username;
            const rawUsername = fullUsername.includes('\\') ? fullUsername.split('\\')[1] : fullUsername;
            const username = rawUsername.toLowerCase(); // Normalize to lowercase
            
            let user = db.getUser(username);
            if (!user) {
                console.log(`Creating new local user: ${username}`);
                db.createUser(username);
                user = db.getUser(username);
                console.log('✓ Local user created');
            } else {
                console.log(`Found existing local user: ${username}`);
                db.updateLastLogin(username);
            }
            
            // Store user info globally
            global.currentUserEmail = user.email;
            global.currentUserIsAdmin = user.is_admin === 1;
            console.log('Local user email:', user.email);
            console.log('Local user is admin:', user.is_admin === 1);
            
            // Always create admin tab even when API is unavailable
            setTimeout(() => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    createAdminTab();
                }
            }, 1000);
        }

        // Initialize email service
        console.log('Initializing email service...');
        emailService = new EmailService();
        await emailService.initialize();
        console.log('✓ Email service initialized');

        console.log('Creating main window...');
        createWindow();
        console.log('✓ Main window created');

        // Close splash screen after main window is ready
        setTimeout(() => {
            console.log('Closing splash screen...');
            closeSplashScreen();
            mainWindow.show();
            console.log('✓ App ready!');
            
            // Send API status to main window
            mainWindow.webContents.send('api-status', { 
                connected: useApi, 
                message: useApi ? 'API connected' : 'Metrics API unavailable - using local storage' 
            });
        }, 2000);
        
        // Fallback: Force close splash after 5 seconds if something goes wrong
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                console.log('⚠️ Force closing splash screen (timeout)');
                closeSplashScreen();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                }
            }
        }, 5000);
    } catch (error) {
        console.error('❌ Fatal error during initialization:', error);
        console.error('Stack trace:', error.stack);
        
        // Close splash and show error
        if (splashWindow) {
            closeSplashScreen();
        }
        
        // Show error dialog
        const { dialog } = require('electron');
        dialog.showErrorBox('Startup Error', 
            `Failed to start Piranha:\n\n${error.message}\n\nCheck the console for details.`);
        
        app.quit();
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
}).catch(error => {
    console.error('❌ Unhandled error in app.whenReady():', error);
    console.error('Stack trace:', error.stack);
    app.quit();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Helper functions for top-level tab management
function createEmailTab() {
    const tabId = ++topLevelTabCounter;
    emailTabId = tabId;

    const browserView = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    browserView.webContents.loadFile('src/renderer/email-inbox.html');

    topLevelViews.set(tabId, {
        view: browserView,
        url: 'email://inbox',
        title: '📧 Email',
        closable: false
    });

    sendTopLevelTabsUpdate();
    return tabId;
}

function createWebContainerTab() {
    const tabId = ++topLevelTabCounter;
    webContainerTabId = tabId;

    const browserView = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    browserView.webContents.loadFile('src/renderer/web-container.html');

    // Create initial nested web tab after container loads
    browserView.webContents.on('did-finish-load', () => {
        setTimeout(() => {
            createWebTab(currentEnv.url, 'Claims App', true, false); // Not closeable
        }, 100);
    });

    topLevelViews.set(tabId, {
        view: browserView,
        url: 'web://container',
        title: '🌐 Web',
        closable: false
    });

    sendTopLevelTabsUpdate();
    return tabId;
}

function createMetricsTab() {
    const tabId = ++topLevelTabCounter;
    metricsTabId = tabId;

    const browserView = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    browserView.webContents.loadFile('src/renderer/metrics.html');

    topLevelViews.set(tabId, {
        view: browserView,
        url: 'metrics://view',
        title: '📊 Metrics',
        closable: false
    });

    sendTopLevelTabsUpdate();
    return tabId;
}

function createAdminTab() {
    const tabId = ++topLevelTabCounter;
    adminTabId = tabId;

    const browserView = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    browserView.webContents.loadFile('src/renderer/admin.html');

    // Open DevTools for admin tab for debugging
    browserView.webContents.on('did-finish-load', () => {
        browserView.webContents.openDevTools({ mode: 'detach' });
    });

    topLevelViews.set(tabId, {
        view: browserView,
        url: 'admin://users',
        title: '⚙️ Admin',
        closable: false
    });

    sendTopLevelTabsUpdate();
    return tabId;
}

// Nested web tab management (inside Web Container)
function createWebTab(url = null, title = 'New Tab', switchTo = true, closable = true) {
    const tabId = ++webTabCounter;

    const { session } = require('electron');
    const persistentSession = session.fromPartition('persist:ivos', {
        cache: true
    });

    persistentSession.webRequest.onBeforeSendHeaders((details, callback) => {
        callback({ requestHeaders: details.requestHeaders });
    });

    const browserView = new BrowserView({
        webPreferences: {
            preload: path.join(__dirname, 'injected/content-script.js'),
            contextIsolation: true,
            nodeIntegration: false,
            session: persistentSession,
            partition: 'persist:ivos',
            webSecurity: true,
            allowRunningInsecureContent: false,
            enablePreferredSizeMode: false
        }
    });

    // Inject CSS to ensure scrollbars are visible
    browserView.webContents.on('did-finish-load', () => {
        browserView.webContents.insertCSS(`
            html, body {
                overflow: auto !important;
                -webkit-overflow-scrolling: touch;
            }
            ::-webkit-scrollbar {
                width: 12px;
                height: 12px;
            }
            ::-webkit-scrollbar-track {
                background: #f1f1f1;
            }
            ::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 6px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: #555;
            }
        `);
    });

    // Intercept new window requests
    browserView.webContents.setWindowOpenHandler(({ url }) => {
        console.log('=== New window requested, opening in new web tab ===');
        console.log('URL:', url);

        let fullUrl = url;
        if (!url.startsWith('http')) {
            const currentUrl = browserView.webContents.getURL();
            try {
                fullUrl = new URL(url, currentUrl).href;
            } catch (e) {
                console.error('Failed to resolve URL:', e);
            }
        }

        // Check if a tab with this URL already exists
        const existingTab = findWebTabByUrl(fullUrl);
        if (existingTab) {
            console.log(`Tab already exists for ${fullUrl}, switching to tab ${existingTab}`);
            switchToWebTab(existingTab);
        } else {
            createWebTab(fullUrl, 'Loading...');
        }
        
        return { action: 'deny' };
    });

    browserView.webContents.on('did-navigate', (event, navUrl) => {
        console.log('Web tab', tabId, 'navigated to:', navUrl);
        if (metricsTracker) {
            metricsTracker.trackNavigation(navUrl);
        }
        updateWebTabTitle(tabId);
    });

    browserView.webContents.on('page-title-updated', (event, pageTitle) => {
        updateWebTabTitle(tabId, pageTitle);
    });

    // Don't open DevTools - it covers the content
    // browserView.webContents.openDevTools();

    webTabs.set(tabId, {
        view: browserView,
        url: url || '',
        title: title,
        closable: closable
    });

    if (url) {
        browserView.webContents.loadURL(url);
    }

    if (switchTo) {
        switchToWebTab(tabId);
    }

    sendWebTabsUpdate();
    return tabId;
}

// Top-level tab switching
function switchToTopLevelTab(tabId) {
    const tabData = topLevelViews.get(tabId);
    if (!tabData) return;

    console.log(`=== Switching to top-level tab ${tabId}: ${tabData.title} ===`);

    // Remove current top-level view
    if (activeTopLevelTabId !== null) {
        const currentTab = topLevelViews.get(activeTopLevelTabId);
        if (currentTab) {
            mainWindow.removeBrowserView(currentTab.view);
        }
    }

    // If switching to web container, also show the active web tab
    if (tabId === webContainerTabId && activeWebTabId !== null) {
        const webTabData = webTabs.get(activeWebTabId);
        if (webTabData) {
            mainWindow.removeBrowserView(webTabData.view);
        }
    }

    // Add new top-level view
    mainWindow.setBrowserView(tabData.view);
    activeTopLevelTabId = tabId;

    // If this is the web container, also show the active web tab
    if (tabId === webContainerTabId && activeWebTabId !== null) {
        const webTabData = webTabs.get(activeWebTabId);
        if (webTabData) {
            mainWindow.addBrowserView(webTabData.view);
        }
    }

    updateBrowserViewBounds();
    sendTopLevelTabsUpdate();
}

// Helper function to find a web tab by URL
function findWebTabByUrl(url) {
    // Normalize URLs for comparison (remove trailing slashes, fragments, etc.)
    const normalizeUrl = (urlString) => {
        try {
            const urlObj = new URL(urlString);
            // Remove hash and trailing slash for comparison
            return urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
        } catch (e) {
            return urlString;
        }
    };

    const normalizedSearchUrl = normalizeUrl(url);

    for (const [tabId, tabData] of webTabs.entries()) {
        const tabUrl = tabData.view.webContents.getURL();
        if (tabUrl && normalizeUrl(tabUrl) === normalizedSearchUrl) {
            return tabId;
        }
    }

    return null;
}

// Nested web tab switching
function switchToWebTab(tabId) {
    const tabData = webTabs.get(tabId);
    if (!tabData) return;

    console.log(`=== Switching to web tab ${tabId}: ${tabData.title} ===`);

    // Remove current web tab view
    if (activeWebTabId !== null) {
        const currentTab = webTabs.get(activeWebTabId);
        if (currentTab) {
            mainWindow.removeBrowserView(currentTab.view);
        }
    }

    // Add new web tab view (only if web container is active)
    if (activeTopLevelTabId === webContainerTabId) {
        mainWindow.addBrowserView(tabData.view);
    }

    activeWebTabId = tabId;
    updateBrowserViewBounds();
    sendWebTabsUpdate();
}

function closeWebTab(tabId) {
    const tabData = webTabs.get(tabId);
    if (!tabData || !tabData.closable) return;

    if (activeWebTabId === tabId) {
        mainWindow.removeBrowserView(tabData.view);
    }

    tabData.view.webContents.destroy();
    webTabs.delete(tabId);

    if (activeWebTabId === tabId) {
        const remainingTabs = Array.from(webTabs.keys());
        if (remainingTabs.length > 0) {
            switchToWebTab(remainingTabs[0]);
        } else {
            activeWebTabId = null;
            createWebTab(currentEnv.url);
        }
    }

    sendWebTabsUpdate();
}

function updateWebTabTitle(tabId, title = null) {
    const tabData = webTabs.get(tabId);
    if (!tabData) return;

    if (title) {
        tabData.title = title;
    } else {
        const pageTitle = tabData.view.webContents.getTitle();
        if (pageTitle) {
            tabData.title = pageTitle;
        }
    }

    tabData.url = tabData.view.webContents.getURL();
    sendWebTabsUpdate();
}

function updateBrowserViewBounds() {
    const bounds = mainWindow.getContentBounds();

    // Top-level tab bounds (Email or Web Container)
    if (activeTopLevelTabId !== null) {
        const topLevelData = topLevelViews.get(activeTopLevelTabId);
        if (topLevelData) {
            const topOffset = 60; // Control panel (tabs are now inside it)
            const bottomOffset = 24; // Status bar
            topLevelData.view.setBounds({
                x: 0,
                y: topOffset,
                width: bounds.width,
                height: bounds.height - topOffset - bottomOffset
            });
        }
    }

    // Nested web tab bounds (only if web container is active)
    if (activeTopLevelTabId === webContainerTabId && activeWebTabId !== null) {
        const webTabData = webTabs.get(activeWebTabId);
        if (webTabData) {
            // Web tabs appear below: control panel (60px) + web tab bar (45px)
            // Toolbar and breadcrumbs are hidden by default, so we don't count them
            const topOffset = 60 + 45; // Control panel + web tab bar
            const bottomOffset = 24; // Status bar
            webTabData.view.setBounds({
                x: 0,
                y: topOffset,
                width: bounds.width,
                height: bounds.height - topOffset - bottomOffset
            });
        }
    }
}

function sendTopLevelTabsUpdate() {
    const tabs = Array.from(topLevelViews.entries()).map(([id, data]) => ({
        id,
        title: data.title || 'Tab',
        url: data.url,
        active: id === activeTopLevelTabId,
        closable: data.closable !== false
    }));

    console.log('Sending top-level tabs update:', tabs);
    mainWindow.webContents.send('tabs-updated', tabs);
}

function sendWebTabsUpdate() {
    const tabs = Array.from(webTabs.entries()).map(([id, data]) => ({
        id,
        title: data.title || 'New Tab',
        url: data.url,
        active: id === activeWebTabId,
        closable: data.closable !== false
    }));

    // Send to web container
    if (webContainerTabId !== null) {
        const webContainerData = topLevelViews.get(webContainerTabId);
        if (webContainerData) {
            webContainerData.view.webContents.send('web-tabs-updated', tabs);
        }
    }
}

// IPC handlers for top-level tabs
ipcMain.handle('switch-tab', async (event, tabId) => {
    switchToTopLevelTab(tabId);
});

ipcMain.handle('get-tabs', async () => {
    return Array.from(topLevelViews.entries()).map(([id, data]) => ({
        id,
        title: data.title || 'Tab',
        url: data.url,
        active: id === activeTopLevelTabId,
        closable: data.closable !== false
    }));
});

ipcMain.handle('get-settings', async () => {
    return settings;
});

ipcMain.handle('get-api-status', async () => {
    return { connected: useApi, apiUrl: settings.apiUrl };
});

ipcMain.handle('get-user-info', async () => {
    const os = require('os');
    const fullUsername = os.userInfo().username;
    const username = fullUsername.includes('\\') ? fullUsername.split('\\')[1] : fullUsername;
    
    return {
        username: username,
        fullUsername: fullUsername,
        hostname: os.hostname(),
        email: global.currentUserEmail || 'mhuss@cbcsclaims.com',
        isAdmin: global.currentUserIsAdmin || false
    };
});

// IPC handlers for nested web tabs
ipcMain.handle('load-url', async (event, url) => {
    if (activeWebTabId !== null) {
        const tabData = webTabs.get(activeWebTabId);
        if (tabData) {
            tabData.view.webContents.loadURL(url);
            if (metricsTracker) {
                metricsTracker.trackNavigation(url);
            }
        }
    }
});

ipcMain.handle('create-web-tab', async (event, url) => {
    return createWebTab(url);
});

ipcMain.handle('switch-web-tab', async (event, tabId) => {
    switchToWebTab(tabId);
});

ipcMain.handle('close-web-tab', async (event, tabId) => {
    closeWebTab(tabId);
});

ipcMain.handle('get-web-tabs', async () => {
    return Array.from(webTabs.entries()).map(([id, data]) => ({
        id,
        title: data.title || 'New Tab',
        url: data.url,
        active: id === activeWebTabId,
        closable: data.closable !== false
    }));
});

ipcMain.handle('hide-browser-view', async () => {
    console.log('=== Hiding BrowserView ===');
    if (activeTabId !== null) {
        const tabData = browserViews.get(activeTabId);
        if (tabData) {
            mainWindow.removeBrowserView(tabData.view);
            console.log('BrowserView removed from window');
        } else {
            console.log('No tab data found for activeTabId:', activeTabId);
        }
    } else {
        console.log('No active tab');
    }
});

ipcMain.handle('show-browser-view', async () => {
    console.log('=== Showing BrowserView ===');
    if (activeTabId !== null) {
        const tabData = browserViews.get(activeTabId);
        if (tabData) {
            mainWindow.setBrowserView(tabData.view);
            updateBrowserViewBounds();
            console.log('BrowserView added back to window');
        } else {
            console.log('No tab data found for activeTabId:', activeTabId);
        }
    } else {
        console.log('No active tab');
    }
});

// Email IPC handlers
ipcMain.handle('get-emails', async (event, options) => {
    try {
        return await emailService.getEmails(options.userEmail, {
            top: options.top,
            folder: options.folder
        });
    } catch (error) {
        console.error('Error in get-emails:', error);
        throw error;
    }
});

ipcMain.handle('get-email-body', async (event, options) => {
    try {
        return await emailService.getEmailBody(options.userEmail, options.messageId);
    } catch (error) {
        console.error('Error in get-email-body:', error);
        throw error;
    }
});

ipcMain.handle('mark-email-read', async (event, options) => {
    try {
        return await emailService.markAsRead(options.userEmail, options.messageId);
    } catch (error) {
        console.error('Error in mark-email-read:', error);
        throw error;
    }
});

ipcMain.handle('search-emails', async (event, options) => {
    try {
        return await emailService.searchEmails(options.userEmail, options.query);
    } catch (error) {
        console.error('Error in search-emails:', error);
        throw error;
    }
});

ipcMain.handle('open-email-tab', async () => {
    if (emailTabId !== null) {
        switchToTopLevelTab(emailTabId);
    }
});

ipcMain.handle('set-zoom', async (event, zoomLevel) => {
    if (activeWebTabId !== null) {
        const tabData = webTabs.get(activeWebTabId);
        if (tabData) {
            tabData.view.webContents.setZoomFactor(zoomLevel);
            console.log(`Set zoom to ${Math.round(zoomLevel * 100)}% for web tab ${activeWebTabId}`);
        }
    }
});

ipcMain.handle('test-notification', async () => {
    // Send test toast to renderer
    mainWindow.webContents.send('email-search-result', {
        claimNumber: 'TEST123',
        emailCount: 3
    });
    console.log('Test toast notification sent');
});

// Listen for navigation events to detect claim changes
ipcMain.on('navigation-detected', (event, data) => {
    const { url, title } = data;

    // Try to extract claim ID from URL or title
    const claimMatch = url.match(/claim[_-]?id[=\/](\w+)/i) ||
        title.match(/claim[:\s]+(\w+)/i);

    if (claimMatch && metricsTracker) {
        const claimId = claimMatch[1];
        metricsTracker.startClaim(claimId, 'unknown'); // Type can be detected later
    }
});

// Helper function to search for emails related to a claim
async function searchClaimEmails(claimNumber) {
    try {
        console.log(`Searching emails for claim: ${claimNumber}`);
        const userEmail = global.currentUserEmail || 'mhuss@cbcsclaims.com'; // Fallback
        console.log(`Using email: ${userEmail}`);
        
        const emails = await emailService.searchEmails(userEmail, claimNumber);

        const emailCount = emails ? emails.length : 0;
        console.log(`Found ${emailCount} email(s) for claim ${claimNumber}`);

        // Send toast notification to renderer
        mainWindow.webContents.send('email-search-result', {
            claimNumber,
            emailCount
        });
    } catch (error) {
        console.error('Error searching claim emails:', error);
    }
}

ipcMain.handle('track-event', async (event, eventData) => {
    // If a claim is detected, start tracking it
    if (eventData.type === 'claim_detected' && eventData.claimId) {
        const claimType = eventData.insuranceType === '1' ? 'liability' :
            eventData.insuranceType === '2' ? 'workers_comp' : 'unknown';
        
        // Track with API or local
        if (useApi && apiService) {
            await apiService.startClaim({
                claimId: eventData.claimId,
                claimNumber: eventData.claimNumber,
                claimantName: eventData.claimantName,
                insuranceType: eventData.insuranceType
            });
        } else if (metricsTracker) {
            metricsTracker.startClaim(eventData.claimId, claimType);
        }
        
        console.log(`Started tracking claim ${eventData.claimId} (${eventData.claimantName})`);

        // Send claim info to renderer
        mainWindow.webContents.send('claim-info-updated', {
            claimId: eventData.claimId,
            claimNumber: eventData.claimNumber,
            claimantName: eventData.claimantName,
            claimType
        });

        // Search for emails related to this claim
        if (eventData.claimNumber) {
            console.log('Claim number detected, searching emails:', eventData.claimNumber);
            searchClaimEmails(eventData.claimNumber);
        } else {
            console.log('No claim number in event data');
        }
    }

    // Handle explicit email search request
    if (eventData.type === 'search_claim_emails' && eventData.claimNumber) {
        searchClaimEmails(eventData.claimNumber);
    }

    // Track event with API or local
    if (useApi && apiService) {
        await apiService.trackEvent(eventData);
    } else if (metricsTracker) {
        metricsTracker.trackEvent(eventData);
    }
});

ipcMain.handle('get-metrics', async (event, filters) => {
    if (useApi && apiService) {
        return await apiService.getMetrics();
    } else if (metricsTracker) {
        return metricsTracker.getMetrics(filters);
    }
    return [];
});

ipcMain.handle('get-session-summary', async () => {
    if (useApi && apiService) {
        return await apiService.getSessionSummary();
    } else if (metricsTracker) {
        return metricsTracker.getSessionSummary();
    }
    return { claims_processed: 0, avg_claim_duration: 0, total_time_seconds: 0 };
});

// Admin functions
ipcMain.handle('get-all-users', async () => {
    if (useApi && apiService) {
        return await apiService.getAllUsers();
    } else if (db) {
        // Return local users with API-compatible format
        const users = db.getAllUsers();
        return users.map(user => ({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin === 1,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at
        }));
    }
    return [];
});

ipcMain.handle('update-user', async (event, userId, userData) => {
    console.log('IPC update-user called:', { userId, userData, useApi });
    
    if (useApi && apiService) {
        try {
            console.log('Calling API updateUser...');
            const result = await apiService.updateUser(userId, userData);
            console.log('API updateUser result:', result);
            return result;
        } catch (error) {
            console.error('API updateUser error:', error);
            throw error;
        }
    } else if (db) {
        // Update local user
        try {
            console.log('Updating local user...');
            db.updateUser(userId, userData.email, userData.isAdmin);
            console.log(`Updated local user ${userId}: email=${userData.email}, isAdmin=${userData.isAdmin}`);
            
            // Return updated user
            const user = db.query('SELECT * FROM users WHERE id = ?', [userId])[0];
            console.log('Retrieved updated user from DB:', user);
            
            if (user) {
                const result = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    isAdmin: user.is_admin === 1,
                    createdAt: user.created_at,
                    lastLoginAt: user.last_login_at
                };
                console.log('Returning user result:', result);
                return result;
            }
        } catch (error) {
            console.error('Failed to update local user:', error);
            throw error;
        }
    }
    console.log('No API or DB available, returning null');
    return null;
});

ipcMain.handle('delete-user', async (event, userId) => {
    if (useApi && apiService) {
        return await apiService.deleteUser(userId);
    } else if (db) {
        // Delete local user
        try {
            db.deleteUser(userId);
            console.log(`Deleted local user ${userId}`);
            return { message: 'User deleted successfully' };
        } catch (error) {
            console.error('Failed to delete local user:', error);
            return null;
        }
    }
    return null;
});

ipcMain.handle('clear-session', async () => {
    const { session } = require('electron');
    const persistentSession = session.fromPartition('persist:ivos');
    await persistentSession.clearStorageData();
    console.log('Session cleared');
});
