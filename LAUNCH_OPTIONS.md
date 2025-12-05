# 🚀 Piranha Launch Options

## Quick Start (Choose One)

### 1. Node.js Launcher (Cross-Platform) ⭐ RECOMMENDED
```bash
npm run start:both
```
**OR**
```bash
node start.js
```

**Features:**
- ✅ Works on Windows, Mac, Linux
- ✅ Single command
- ✅ Automatically kills API when app closes
- ✅ Handles Ctrl+C gracefully

---

### 2. Concurrently (Parallel Execution)
```bash
npm run start:all
```

**Features:**
- ✅ Shows both outputs in same terminal
- ✅ Color-coded output
- ✅ Good for development

---

### 3. PowerShell Script (Windows)
```powershell
.\start.ps1
```

**Features:**
- ✅ Opens API in separate window
- ✅ Clean separation of concerns
- ✅ Easy to monitor each process

---

### 4. Batch File (Windows)
```cmd
start.bat
```

**Features:**
- ✅ Simple CMD script
- ✅ Opens API in separate window
- ✅ Works on older Windows versions

---

## Manual Start (Development)

### Terminal 1 - API
```bash
cd api
dotnet run
```

### Terminal 2 - Electron
```bash
npm start
```

**When to use:**
- 🔧 Active development
- 🐛 Debugging
- 📊 Need to see separate logs

---

## What Each Method Does

| Method | API Window | Electron Window | Cleanup | Best For |
|--------|-----------|-----------------|---------|----------|
| `npm run start:both` | Same terminal | Same terminal | Automatic | Daily use |
| `npm run start:all` | Same terminal | Same terminal | Manual | Development |
| `start.ps1` | Separate | Current | Manual | Windows users |
| `start.bat` | Separate | Current | Manual | Windows users |
| Manual | Terminal 1 | Terminal 2 | Manual | Debugging |

---

## Stopping the App

### If using `npm run start:both`:
- Press `Ctrl+C` once - stops both API and Electron

### If using `start.ps1` or `start.bat`:
- Close Electron window
- Close API window (or press `Ctrl+C`)

### If using `npm run start:all`:
- Press `Ctrl+C` once - stops both

### If running manually:
- Press `Ctrl+C` in each terminal

---

## Troubleshooting

### "dotnet: command not found"
Install .NET 9.0 SDK from https://dotnet.microsoft.com/download

### "Port 5000 already in use"
Kill the process using port 5000:
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:5000 | xargs kill
```

### API starts but Electron can't connect
1. Check API is running: http://localhost:5000/api/metrics/health
2. Check firewall settings
3. Verify `config/settings.json` has correct URL

---

## Recommended Workflow

**For Daily Use:**
```bash
npm run start:both
```

**For Development:**
```bash
# Terminal 1
cd api && dotnet run

# Terminal 2  
npm start
```

**For Testing Without API:**
```bash
# Don't start API
npm start
# App will show warning and use local database
```
