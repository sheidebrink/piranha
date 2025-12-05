# PowerShell script to start both API and Electron app
Write-Host "🐟 Starting Piranha..." -ForegroundColor Cyan

# Start the API in a new window
Write-Host "Starting .NET API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd api; dotnet run"

# Wait a moment for API to start
Write-Host "Waiting for API to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Start the Electron app
Write-Host "Starting Electron app..." -ForegroundColor Green
npm start

Write-Host "✅ Piranha started!" -ForegroundColor Green
