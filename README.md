# Adjuster Assistant

Electron-based browser wrapper for 3rd party claims management SaaS with navigation assistance, validation, and performance tracking.

## Features

- **Embedded Browser**: Loads 3rd party SaaS app in a controlled BrowserView
- **Performance Tracking**: Captures metrics on claim processing time, tab usage, and field completion
- **Validation Overlay**: Real-time validation for required fields based on claim type
- **Session Analytics**: Track adjuster performance and generate reports
- **SQLite Database**: Local storage for all metrics and events

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
