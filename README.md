# 🐟 Piranha - Claims Assistant

**Stay on top of what you're asked to do.**

Piranha is an Electron-based claims management assistant that wraps your 3rd party SaaS with powerful features: email integration, performance tracking, multi-tab workflow, and intelligent notifications.

## Features

### 🐟 Core Capabilities
- **Multi-Tab Workflow**: Work on multiple claims simultaneously with browser-like tabs
- **Email Integration**: Built-in O365 inbox with claim-email correlation
- **Smart Notifications**: Automatic alerts when emails match open claims
- **No More Popups**: Intercepts new windows and opens them as organized tabs
- **Session Persistence**: Stay logged in across app restarts

### 📊 Performance & Tracking
- **Performance Metrics**: Track time per claim, tab usage, and completion rates
- **SQLite Database**: Local storage for all metrics and analytics
- **Session Analytics**: Generate reports on adjuster productivity
- **Claim Detection**: Automatically identifies and tracks claim information

### 📧 Email Features
- **Integrated Inbox**: View O365 emails without leaving the app
- **Claim Correlation**: Automatic search for emails related to current claim
- **Reply Indicators**: Visual cues for emails needing responses
- **Smart Filtering**: Filter by unreplied emails, folders, and search
- **Desktop Notifications**: Get notified of claim-related emails

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

## Project Structure

```
src/
├── main.js                 # Electron main process
├── preload.js             # Preload script for main window
├── database/
│   └── db.js              # SQLite database manager
├── metrics/
│   └── tracker.js         # Performance tracking logic
├── renderer/
│   ├── index.html         # Control panel UI
│   ├── styles.css         # Styles
│   └── renderer.js        # Control panel logic
└── injected/
    └── content-script.js  # Script injected into 3rd party app

config/
└── validation-rules.json  # Validation rules by claim type
```

## Database Schema

- **sessions**: Track user sessions
- **claims**: Individual claim records with timing
- **events**: All user interactions and events
- **tab_interactions**: Time spent on each tab
- **validations**: Field validation results

## Configuration

Edit `config/validation-rules.json` to customize validation rules for different claim types.

## Next Steps

1. Configure the 3rd party app URL
2. Customize validation rules for your claim types
3. Add reporting/export functionality
4. Implement user authentication if needed
5. Add keyboard shortcuts for common actions
