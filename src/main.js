const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const MetricsTracker = require('./metrics/tracker');
const Database = require('./database/db');

let mainWindow;
let browserViews = new Map(); // Map of tabId -> BrowserView
let activeTabId = null;
let tabCounter = 0;
let metricsTracker;
let db;

// Window bounds management
function loadWindowBounds() {
    const fs = require('fs');
    const boundsPath = path.join(app.getPath('userData'), 'window-bounds.json');

    try {
        if (fs.existsSync(boundsPath)) {
            const bounds = JSON.parse(fs.readFileSync(boundsPath, 'utf8'));
            console.log('Loaded window bounds:', bounds);
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
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Load the control panel UI
    mainWindow.loadFile('src/renderer/index.html');

    // Don't open DevTools for main window - it gets covered by BrowserView
    // mainWindow.webContents.openDevTools();

    // Create initial tab
    createNewTab('https://test-cbcs.ventivclient.com/ivos/login.jsp');

    mainWindow.on('resize', () => {
        updateBrowserViewBounds();
    });

    // Save window position and size when moved or resized
    mainWindow.on('moved', saveWindowBounds);
    mainWindow.on('resized', saveWindowBounds);

    // Save on close
    mainWindow.on('close', saveWindowBounds);
}

app.whenReady().then(() => {
    db = new Database();
    metricsTracker = new MetricsTracker(db);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Helper functions for tab management
function createNewTab(url = null, title = 'New Tab') {
    const tabId = ++tabCounter;

    const { session } = require('electron');
    const persistentSession = session.fromPartition('persist:ivos', {
        cache: true
    });

    // Configure session to handle SSO properly
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
            allowRunningInsecureContent: false
        }
    });

    // Intercept new window requests - open in new tab
    browserView.webContents.setWindowOpenHandler(({ url, frameName, features }) => {
        console.log('=== New window requested, opening in new tab ===');
        console.log('URL:', url);

        // Resolve relative URLs
        let fullUrl = url;
        if (!url.startsWith('http')) {
            const currentUrl = browserView.webContents.getURL();
            try {
                fullUrl = new URL(url, currentUrl).href;
            } catch (e) {
                console.error('Failed to resolve URL:', e);
            }
        }

        // Create new tab for this claim
        createNewTab(fullUrl, 'Loading...');

        return { action: 'deny' };
    });

    // Listen for navigation
    browserView.webContents.on('did-navigate', (event, navUrl) => {
        console.log('Tab', tabId, 'navigated to:', navUrl);
        metricsTracker.trackNavigation(navUrl);
        updateTabTitle(tabId);
    });

    browserView.webContents.on('page-title-updated', (event, pageTitle) => {
        updateTabTitle(tabId, pageTitle);
    });

    // Open DevTools for each new tab
    browserView.webContents.openDevTools();

    browserViews.set(tabId, {
        view: browserView,
        url: url || '',
        title: title
    });

    if (url) {
        browserView.webContents.loadURL(url);
    }

    switchToTab(tabId);
    sendTabsUpdate();

    return tabId;
}

function switchToTab(tabId) {
    const tabData = browserViews.get(tabId);
    if (!tabData) return;

    // Remove current BrowserView
    if (activeTabId !== null) {
        const currentTab = browserViews.get(activeTabId);
        if (currentTab) {
            mainWindow.removeBrowserView(currentTab.view);
        }
    }

    // Add new BrowserView
    mainWindow.setBrowserView(tabData.view);
    activeTabId = tabId;

    updateBrowserViewBounds();
    sendTabsUpdate();
}

function closeTab(tabId) {
    const tabData = browserViews.get(tabId);
    if (!tabData) return;

    // Destroy the BrowserView
    if (activeTabId === tabId) {
        mainWindow.removeBrowserView(tabData.view);
    }
    tabData.view.webContents.destroy();
    browserViews.delete(tabId);

    // Switch to another tab if this was active
    if (activeTabId === tabId) {
        const remainingTabs = Array.from(browserViews.keys());
        if (remainingTabs.length > 0) {
            switchToTab(remainingTabs[0]);
        } else {
            activeTabId = null;
            // Create a new tab if all are closed
            createNewTab('https://test-cbcs.ventivclient.com/ivos/login.jsp');
        }
    }

    sendTabsUpdate();
}

function updateTabTitle(tabId, title = null) {
    const tabData = browserViews.get(tabId);
    if (!tabData) return;

    if (title) {
        tabData.title = title;
    } else {
        // Get title from webContents
        const pageTitle = tabData.view.webContents.getTitle();
        if (pageTitle) {
            tabData.title = pageTitle;
        }
    }

    tabData.url = tabData.view.webContents.getURL();
    sendTabsUpdate();
}

function updateBrowserViewBounds() {
    if (activeTabId === null) return;

    const tabData = browserViews.get(activeTabId);
    if (!tabData) return;

    const topOffset = 130; // 60px controls + 35px breadcrumbs + 35px tabs
    const bounds = mainWindow.getContentBounds();
    tabData.view.setBounds({
        x: 0,
        y: topOffset,
        width: bounds.width,
        height: bounds.height - topOffset
    });
}

function sendTabsUpdate() {
    const tabs = Array.from(browserViews.entries()).map(([id, data]) => ({
        id,
        title: data.title || 'New Tab',
        url: data.url,
        active: id === activeTabId
    }));

    mainWindow.webContents.send('tabs-updated', tabs);
}

// IPC handlers
ipcMain.handle('load-url', async (event, url) => {
    if (activeTabId !== null) {
        const tabData = browserViews.get(activeTabId);
        if (tabData) {
            tabData.view.webContents.loadURL(url);
            metricsTracker.trackNavigation(url);
        }
    }
});

ipcMain.handle('create-tab', async (event, url) => {
    return createNewTab(url);
});

ipcMain.handle('switch-tab', async (event, tabId) => {
    switchToTab(tabId);
});

ipcMain.handle('close-tab', async (event, tabId) => {
    closeTab(tabId);
});

ipcMain.handle('get-tabs', async () => {
    return Array.from(browserViews.entries()).map(([id, data]) => ({
        id,
        title: data.title || 'New Tab',
        url: data.url,
        active: id === activeTabId
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

// Listen for navigation events to detect claim changes
ipcMain.on('navigation-detected', (event, data) => {
    const { url, title } = data;

    // Try to extract claim ID from URL or title
    const claimMatch = url.match(/claim[_-]?id[=\/](\w+)/i) ||
        title.match(/claim[:\s]+(\w+)/i);

    if (claimMatch) {
        const claimId = claimMatch[1];
        metricsTracker.startClaim(claimId, 'unknown'); // Type can be detected later
    }
});

ipcMain.handle('track-event', async (event, eventData) => {
    // If a claim is detected, start tracking it
    if (eventData.type === 'claim_detected' && eventData.claimId) {
        const claimType = eventData.insuranceType === '1' ? 'liability' :
            eventData.insuranceType === '2' ? 'workers_comp' : 'unknown';
        metricsTracker.startClaim(eventData.claimId, claimType);
        console.log(`Started tracking claim ${eventData.claimId} (${eventData.claimantName})`);

        // Send claim info to renderer
        mainWindow.webContents.send('claim-info-updated', {
            claimId: eventData.claimId,
            claimantName: eventData.claimantName,
            claimType
        });
    }

    metricsTracker.trackEvent(eventData);
});

ipcMain.handle('get-metrics', async (event, filters) => {
    return metricsTracker.getMetrics(filters);
});

ipcMain.handle('get-session-summary', async () => {
    return metricsTracker.getSessionSummary();
});

ipcMain.handle('clear-session', async () => {
    const { session } = require('electron');
    const persistentSession = session.fromPartition('persist:ivos');
    await persistentSession.clearStorageData();
    console.log('Session cleared');
});
