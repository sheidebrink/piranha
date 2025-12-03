# Navigation Assistance for Complex Pages

## The Problem
The 3rd party SaaS has claims with 100+ tabs spread across frames, making it difficult for adjusters to:
- Find the right tab quickly
- Remember which tabs they've completed
- Know which tabs have required fields
- Navigate efficiently through their workflow

## Solutions Implemented

### 1. Tab Navigator (Floating Button)
A floating 🗂️ button appears on complex pages that opens a navigation panel with:

**Features:**
- **Search**: Type to filter tabs by name
- **Favorites**: Star frequently used tabs for quick access
- **Recent**: Shows last 10 tabs visited
- **Categories**: Tabs grouped by type:
  - 📋 General (Overview, Summary, Details)
  - 👤 Claimant (Personal Info, Contact)
  - 🏥 Medical (Treatment, Diagnosis, Injury)
  - 💰 Financial (Payments, Benefits, Reserves)
  - 📄 Documents (Files, Attachments)
  - 📝 Notes (Diary, Comments, Activity)
  - ⚖️ Legal (Attorney, Litigation)
  - 🏢 Employer (Company, Organization)

**Usage:**
1. Click the 🗂️ button (bottom right)
2. Search or browse tabs
3. Click a tab name to navigate
4. Star favorites for quick access

### 2. Smart Detection
The system automatically:
- Detects when a page has 10+ tabs
- Shows a helpful hint about the navigator
- Works with tabs in iframes
- Tracks which tabs you visit most

### 3. Keyboard Shortcuts (Future)
Planned shortcuts:
- `Ctrl+K`: Open tab navigator
- `Ctrl+F`: Search tabs
- `Ctrl+1-9`: Jump to favorite tabs
- `Alt+Left/Right`: Previous/Next tab

### 4. Workflow Guides (Future)
Pre-defined workflows for common claim types:
- **New Claim**: General → Claimant → Injury → Employer → Save
- **Medical Update**: Medical → Treatment → Documents → Notes
- **Payment**: Financial → Benefits → Reserve → Approve

### 5. Required Fields Indicator (Future)
Visual indicators showing:
- ✅ Tab complete (all required fields filled)
- ⚠️ Tab incomplete (missing required fields)
- 📝 Tab in progress (some fields filled)
- ⭕ Tab not started

### 6. Progress Tracking (Future)
Dashboard showing:
- % of tabs completed
- Estimated time remaining
- Required vs optional tabs
- Validation errors by tab

## Technical Implementation

### Tab Detection
```javascript
// Detects tabs in main document and iframes
function detectPageTabs() {
  const selectors = [
    '[role="tab"]',
    '.tab',
    'a[onclick*="tab"]',
    'li[onclick]'
  ];
  
  // Check main document
  // Check all iframes (if accessible)
  // Return array of tab objects
}
```

### Frame Navigation
Since the app uses frames, the assistant:
- Scans all accessible frames for tabs
- Tracks navigation across frames
- Maintains state per frame
- Handles cross-origin restrictions

### Storage
- Favorites stored in localStorage
- Recent tabs stored in memory
- Synced across sessions
- Per-user preferences

## User Benefits

1. **Faster Navigation**: Find tabs in seconds vs minutes
2. **Less Training**: Visual categories reduce learning curve
3. **Fewer Errors**: Don't miss required tabs
4. **Better Workflow**: Follow proven paths
5. **Reduced Frustration**: No more hunting for tabs

## Metrics Tracked

The system tracks:
- Time spent per tab
- Most visited tabs
- Search queries (to improve categorization)
- Navigation patterns
- Completion rates

This data helps:
- Identify confusing tabs
- Optimize workflows
- Train new adjusters
- Improve the 3rd party app (feedback to vendor)
