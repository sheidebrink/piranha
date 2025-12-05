# 🐟 Piranha - Quick Start Guide

## Starting Both API and App Together

### Option 1: PowerShell Script (Recommended for Windows)
```powershell
.\start.ps1
```

This will:
1. Open a new window with the .NET API running
2. Wait 3 seconds for API to initialize
3. Start the Electron app in the current window

### Option 2: Batch File
```cmd
start.bat
```

Same as PowerShell but uses CMD instead.

### Option 3: NPM Script
```bash
npm run start:all
```

Runs both API and Electron app in the same terminal window with colored output.

## Starting Individually

### Just the API
```bash
npm run start:api
# OR
cd api
dotnet run
```

### Just the Electron App
```bash
npm start
```

## What Happens on Startup

1. **API Check**: The Electron app tries to connect to the API at `http://localhost:5000`
2. **If API is running**: 
   - ✅ "Using API for metrics tracking" in console
   - All metrics sent to API
3. **If API is NOT running**:
   - ⚠️ Warning toast notification appears
   - Falls back to local SQLite database
   - App works normally

## Stopping the App

- **Electron App**: Close the window or press `Ctrl+C` in terminal
- **API**: Press `Ctrl+C` in the API terminal window

## Troubleshooting

### API won't start
- Make sure .NET 9.0 SDK is installed: `dotnet --version`
- Check if port 5000 is already in use

### Electron won't connect to API
- Verify API is running: Open `http://localhost:5000/api/metrics/health` in browser
- Check `config/settings.json` has correct `apiUrl`

### Both start but don't communicate
- Check Windows Firewall isn't blocking localhost connections
- Verify CORS is enabled in API (it should be by default)

## Configuration

Edit `config/settings.json` to change:
- API URL
- Environment (QA/PROD)
- App version

## Development Tips

- Use `npm run start:api` in one terminal
- Use `npm start` in another terminal
- This gives you better control and visibility of logs

## Production Deployment

For production, you'll want to:
1. Deploy the API to a server (Azure, AWS, etc.)
2. Update `config/settings.json` with production API URL
3. Build the Electron app: `npm run build` (when configured)
