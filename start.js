#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('\n🐟 Starting Piranha...\n');

// Start the API
console.log('📡 Starting .NET API...');
const apiProcess = spawn('dotnet', ['run'], {
    cwd: path.join(__dirname, 'api'),
    stdio: 'inherit',
    shell: true
});

apiProcess.on('error', (err) => {
    console.error('❌ Failed to start API:', err.message);
    console.log('⚠️  Continuing without API - app will use local database');
});

// Wait for API to initialize
console.log('⏳ Waiting for API to initialize...\n');
setTimeout(() => {
    console.log('🚀 Starting Electron app...\n');
    
    // Start Electron
    const electronProcess = spawn('npm', ['start'], {
        stdio: 'inherit',
        shell: true
    });

    electronProcess.on('close', (code) => {
        console.log('\n👋 Electron app closed');
        // Kill API when Electron closes
        apiProcess.kill();
        process.exit(code);
    });

    electronProcess.on('error', (err) => {
        console.error('❌ Failed to start Electron:', err.message);
        apiProcess.kill();
        process.exit(1);
    });
}, 3000);

// Handle Ctrl+C
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down...');
    apiProcess.kill();
    process.exit(0);
});
