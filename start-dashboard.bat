@echo off
echo Starting Network Dashboard...
echo ================================

REM Set environment variables
set MYSQL_PASSWORD=Wanzala@8728!
set TOKEN_SECRET=dev_secret

echo Starting Backend Server...
cd backend
start "Backend Server" cmd /k "node server.js"
cd ..

echo Starting Frontend Server...
cd frontend
start "Frontend Server" cmd /k "npm run dev"
cd ..

echo Dashboard is starting...
echo Backend API: http://localhost:3001
echo Frontend App: http://localhost:5173
echo Admin Login: wanzala / wanzala@2026

echo Opening Dashboard in browser...
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo Dashboard startup complete!
pause