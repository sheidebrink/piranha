@echo off
echo.
echo ========================================
echo   Starting Piranha
echo ========================================
echo.

echo Starting .NET API...
start "Piranha API" cmd /k "cd api && dotnet run"

echo Waiting for API to initialize...
timeout /t 3 /nobreak > nul

echo Starting Electron app...
npm start

echo.
echo Done!
