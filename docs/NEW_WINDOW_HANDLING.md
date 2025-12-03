# How the App Handles New Windows

## The Problem
Your 3rd party SaaS opens each claim/record in a new browser window with toolbars removed. This creates several issues:
- Adjusters lose context switching between windows
- No way to track which claim they're working on
- Windows pile up and become hard to manage
- No validation or assistance available in those windows

## Our Solution

### 1. Window Interception
When the 3rd party app tries to open a new window (via `window.open()` or target="_blank"), we intercept it:

```javascript
browserView.webContents.setWindowOpenHandler(({ url, frameName }) => {
  // Track the event
  metricsTracker.trackEvent({
    type: 'new_window_opened',
    url,
    frameName
  });

  // Load in same view instead
  browserView.webContents.loadURL(url);
  
  return { action: 'deny' }; // Prevent actual new window
});
```

### 2. Navigation History
Instead of multiple windows, we maintain a navigation history with breadcrumbs:
- Back/Forward buttons to navigate between claims
- Breadcrumb trail showing recent claims
- Click any breadcrumb to jump back to that claim

### 3. Automatic Claim Detection
The content script automatically detects when a new claim is loaded:
- Scans the page for claim IDs in common locations
- Extracts claim type if available
- Starts tracking metrics for that claim
- Continues tracking as adjuster works through tabs

### 4. Continuous Tracking
Even as adjusters navigate between claims:
- Each claim gets its own tracking session
- Time spent per claim is recorded
- Tab interactions are tracked per claim
- Field validations are associated with the correct claim

## Benefits

1. **Single Window Experience**: All claims open in one app window
2. **Context Preservation**: Navigation history and breadcrumbs
3. **Continuous Tracking**: Metrics captured across all claims
4. **Validation Support**: Our validation rules work on every claim
5. **Better UX**: No window management headaches

## Customization

You can customize claim detection in `src/injected/content-script.js`:

```javascript
function detectClaimInfo() {
  // Adjust these selectors to match your app's HTML structure
  const claimIdElement = document.querySelector('[data-claim-id]');
  const claimTypeElement = document.querySelector('[data-claim-type]');
  // ... extract and track
}
```

## Future Enhancements

- **Multi-tab support**: Open multiple claims in tabs (like a browser)
- **Claim switcher**: Quick dropdown to switch between recent claims
- **Claim comparison**: View two claims side-by-side
- **Smart suggestions**: "You were working on Claim X, continue?"
