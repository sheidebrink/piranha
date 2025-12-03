# Tab System Implementation

## Overview
The app now supports multiple tabs, allowing adjusters to work on multiple claims simultaneously without losing context.

## Features

### Multiple Tabs
- Each claim opens in its own tab
- Tabs show the claimant name as the title
- Active tab is highlighted in blue
- Inactive tabs are gray

### Tab Management
- **New Tab Button (+)**: Creates a new tab with the login page
- **Switch Tabs**: Click any tab to switch to that claim
- **Close Tabs**: Click the × button on any tab to close it
- **Auto-create**: If all tabs are closed, a new one is automatically created

### Window Interception
When a record is double-clicked in the 3rd party app:
- Instead of opening a new browser window, it creates a new tab
- The claim loads in the new tab
- The tab title updates to show the claimant name

## Technical Details

### Architecture
- **Multiple BrowserViews**: Each tab has its own BrowserView instance
- **Tab Switching**: Only the active tab's BrowserView is attached to the window
- **Memory Management**: Closed tabs have their BrowserViews destroyed
- **Session Persistence**: All tabs share the same persistent session (cookies, login state)

### Data Structure
```javascript
browserViews = Map {
  1 => { view: BrowserView, url: '...', title: 'ALEGRIA, JAMES' },
  2 => { view: BrowserView, url: '...', title: 'SMITH, JOHN' },
  3 => { view: BrowserView, url: '...', title: 'DOE, JANE' }
}
```

### Metrics Tracking
- Each tab's navigation is tracked independently
- Claim detection works per tab
- Metrics are associated with the correct claim
- Session summary includes all claims across all tabs

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│ [URL Input] [Load] [Back] [Forward] [Metrics] [Clear]│  60px
├─────────────────────────────────────────────────────┤
│ Home › Claims › Search                               │  35px (breadcrumbs)
├─────────────────────────────────────────────────────┤
│ [Tab 1] [Tab 2] [Tab 3*] [+]                        │  35px (tabs)
├─────────────────────────────────────────────────────┤
│                                                      │
│                                                      │
│              BrowserView Content                     │
│                                                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

## User Workflow

1. **Login**: Opens in first tab
2. **Search for claims**: Search results appear
3. **Double-click claim**: Opens in new tab automatically
4. **Work on claim**: Fill out forms, navigate tabs within the claim
5. **Switch to another claim**: Click a different tab or double-click another record
6. **Close completed claim**: Click × on the tab
7. **Continue working**: All other tabs remain open and active

## Benefits

- **No window clutter**: All claims in one organized window
- **Easy switching**: Click to switch between claims
- **Preserved state**: Each claim maintains scroll position and form data
- **Complete tracking**: All interactions tracked per claim
- **Familiar UX**: Works like a web browser with tabs
