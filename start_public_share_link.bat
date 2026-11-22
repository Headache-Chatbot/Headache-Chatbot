@echo off
chcp 65001 > nul
title Clinical Decision Support - Public Online Share Link

echo =====================================================================
echo    CLINICAL DECISION SUPPORT - 100%% FREE PUBLIC ONLINE SHARE LINK
echo =====================================================================
echo.
echo [1/2] Starting local Python Backend on port 8000...
start /b "" py "%~dp0desktop_main.py"

timeout /t 3 > nul

echo [2/2] Generating your secure public HTTPS link...
echo.
echo =====================================================================
echo   YOUR LIVE PUBLIC LINK WILL APPEAR BELOW (look for https://...):
echo   Send this link to anyone on WhatsApp, email, or mobile!
echo =====================================================================
echo.

C:\Windows\System32\OpenSSH\ssh.exe -o StrictHostKeyChecking=no -R 80:127.0.0.1:8000 nokey@localhost.run
pause
