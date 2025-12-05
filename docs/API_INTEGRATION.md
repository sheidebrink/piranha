# Piranha API Integration

## Overview

The Piranha Electron app now supports connecting to a standalone .NET API for metrics tracking. The app gracefully falls back to local SQLite storage if the API is unavailable.

## Architecture

```
┌─────────────────────┐
│  Electron App       │
│  (Piranha)          │
│                     │
│  ┌───────────────┐  │
│  │ API Service   │──┼──► HTTP ──► ┌──────────────────┐
│  └───────────────┘  │             │  .NET API        │
│         │           │             │  (Port 5000)     │
│         ↓ (fallback)│             │                  │
│  ┌───────────────┐  │             │  ┌────────────┐  │
│  │ Local Tracker │  │             │  │  SQLite DB │  │
│  │ + SQLite      │  │             │  └────────────┘  │
│  └───────────────┘  │             └──────────────────┘
└─────────────────────┘
```

## Setup

### 1. Start the API (Optional)

```bash
cd api
dotnet run
```

The API will start on `http://localhost:5000`

### 2. Start the Electron App

```bash
npm start
```

The app will:
1. Try to connect to the API at startup
2. If successful: Use API for all metrics tracking
3. If failed: Fall back to local SQLite database
4. Show a toast notification if API is unavailable

## Configuration

Edit `config/settings.json` to change the API URL:

```json
{
  "apiUrl": "http://localhost:5000/api",
  ...
}
```

## API Endpoints

### Health Check
- `GET /api/metrics/health` - Check if API is running

### Session Management
- `POST /api/metrics/session/start` - Start a new session
- Returns: `{ id, userId, startTime }`

### Claim Tracking
- `POST /api/metrics/claim/start` - Start tracking a claim
- `POST /api/metrics/claim/end/{claimId}` - End claim tracking

### Event Tracking
- `POST /api/metrics/event` - Track any event

### Metrics
- `GET /api/metrics/session/{sessionId}/summary` - Get session summary
- `GET /api/metrics/metrics` - Get aggregated metrics by claim type

## Behavior

### With API Connected
- ✅ All metrics sent to API
- ✅ Centralized data storage
- ✅ Multiple users can share data
- ✅ Real-time metrics aggregation

### Without API (Fallback)
- ⚠️ Toast notification shown
- ✅ App continues to work normally
- ✅ Metrics stored locally in SQLite
- ✅ All features remain functional

## Development

### API Project Structure
```
api/
├── Controllers/
│   └── MetricsController.cs    # API endpoints
├── Data/
│   └── MetricsDbContext.cs     # EF Core context
├── Models/
│   └── MetricsModels.cs        # Data models
├── Program.cs                   # API configuration
├── appsettings.json            # Settings
└── README.md                    # API documentation
```

### Electron Integration
```
src/
├── services/
│   └── api-service.js          # API client
├── metrics/
│   └── tracker.js              # Local fallback tracker
└── main.js                      # API connection logic
```

## Testing

1. **Test with API running:**
   ```bash
   cd api && dotnet run
   # In another terminal:
   npm start
   ```
   - Should see: "✅ Using API for metrics tracking"
   - No warning toast

2. **Test without API:**
   ```bash
   # Don't start the API
   npm start
   ```
   - Should see: "⚠️ API unavailable, using local database"
   - Warning toast appears
   - App works normally

## Future Enhancements

- [ ] API authentication
- [ ] User-specific sessions
- [ ] Cloud deployment
- [ ] Real-time dashboard
- [ ] Export metrics to Excel/PDF
- [ ] Email reports
