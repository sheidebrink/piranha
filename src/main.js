const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const MetricsTracker = require('./metrics/tracker');
const Database = require('./database/db');
const EmailService = require('./services/email-service');

let mainWindow;
let browserViews = new Map(); // Map of tabId -> BrowserView
let activeTabId = null;
let tabCounter = 0;
let metricsTracker;
let db;
let emailService;
let emailTabId = null; // Special tab for email inbox
let splashWindow = null;

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

    // Don't open DevTools for main window - it gets covered by BrowserView
    // mainWindow.webContents.openDevTools();

    // Create email inbox tab (permanent, unclosable) - this will be active first
    createEmailTab();

    // Create initial claims tab in background after a short delay
    setTimeout(() => {
        createNewTab('https://test-cbcs.ventivclient.com/ivos/login.jsp', 'Claims App', false);
    }, 500);

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
    splashWindow = new BrowserWindow({
        width: 500,
        height: 400,
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
    splashWindow.center();
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

    // Show splash screen
    createSplashScreen();

    db = new Database();
    metricsTracker = new MetricsTracker(db);

    // Initialize email service
    emailService = new EmailService();
    await emailService.initialize();

    createWindow();

    // Close splash screen after main window is ready
    setTimeout(() => {
        closeSplashScreen();
        mainWindow.show();
    }, 2000);

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
function createEmailTab() {
    const tabId = ++tabCounter;
    emailTabId = tabId;

    // Use default session for email tab (no preload script)
    const browserView = new BrowserView({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
            // No preload script - this is our own HTML file
        }
    });

    browserView.webContents.loadFile('src/renderer/email-inbox.html');

    browserViews.set(tabId, {
        view: browserView,
        url: 'email://inbox',
        title: '📧 Email',
        isEmail: true,
        closable: false
    });

    switchToTab(tabId);
    sendTabsUpdate();

    return tabId;
}

function createNewTab(url = null, title = 'New Tab', switchTo = true) {
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
        title: title,
        isEmail: false,
        closable: true
    });

    if (url) {
        browserView.webContents.loadURL(url);
    }

    // Only switch if requested AND if we're not creating a background tab
    if (switchTo) {
        switchToTab(tabId);
    } else {
        // Just add to the map, don't switch
        console.log(`Created tab ${tabId} in background: ${title}`);
    }
    sendTabsUpdate();

    return tabId;
}

function switchToTab(tabId) {
    const tabData = browserViews.get(tabId);
    if (!tabData) return;

    console.log(`=== Switching to tab ${tabId}: ${tabData.title} ===`);

    // Remove current BrowserView
    if (activeTabId !== null) {
        const currentTab = browserViews.get(activeTabId);
        if (currentTab) {
            console.log(`Removing current tab ${activeTabId}: ${currentTab.title}`);
            mainWindow.removeBrowserView(currentTab.view);
        }
    }

    // Add new BrowserView
    console.log(`Adding BrowserView for tab ${tabId}: ${tabData.title}`);
    mainWindow.setBrowserView(tabData.view);
    activeTabId = tabId;

    updateBrowserViewBounds();
    sendTabsUpdate();
}

function closeTab(tabId) {
    const tabData = browserViews.get(tabId);
    if (!tabData) return;

    // Don't allow closing the email tab
    if (tabData.isEmail || !tabData.closable) {
        console.log('Cannot close email tab');
        return;
    }

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
        active: id === activeTabId,
        closable: data.closable !== false
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
    // Switch to email tab if it exists
    if (emailTabId !== null) {
        switchToTab(emailTabId);
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

// Helper function to search for emails related to a claim
async function searchClaimEmails(claimNumber) {
    try {
        console.log(`Searching emails for claim: ${claimNumber}`);
        const emails = await emailService.searchEmails('mhuss@cbcsclaims.com', claimNumber);

        const emailCount = emails ? emails.length : 0;
        console.log(`Found ${emailCount} email(s) for claim ${claimNumber}`);

        // Show notification
        const { Notification } = require('electron');
        const notification = new Notification({
            title: `📧 ${emailCount} Email${emailCount !== 1 ? 's' : ''} Found`,
            body: emailCount > 0
                ? `Found ${emailCount} email${emailCount > 1 ? 's' : ''} related to claim ${claimNumber}.\nClick to view in inbox.`
                : `No emails found for claim ${claimNumber}.`,
            icon: null,
            timeoutType: 'default'
        });

        if (emailCount > 0) {
            notification.on('click', () => {
                // Switch to email tab
                if (emailTabId !== null) {
                    switchToTab(emailTabId);
                    // Send search query to email tab
                    mainWindow.webContents.send('search-emails-for-claim', claimNumber);
                }
            });
        }

        notification.show();
    } catch (error) {
        console.error('Error searching claim emails:', error);
    }
}

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
            claimNumber: eventData.claimNumber,
            claimantName: eventData.claimantName,
            claimType
        });

        // Search for emails related to this claim
        if (eventData.claimNumber) {
            searchClaimEmails(eventData.claimNumber);
        }
    }

    // Handle explicit email search request
    if (eventData.type === 'search_claim_emails' && eventData.claimNumber) {
        searchClaimEmails(eventData.claimNumber);
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
