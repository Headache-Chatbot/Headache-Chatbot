@echo off
chcp 65001 > nul
title Clinical Decision Support - Fast Cloudflare Public Share Link

echo =====================================================================
echo    CLINICAL DECISION SUPPORT - FAST CLOUDFLARE PUBLIC SHARE LINK
echo =====================================================================
echo.
echo [1/2] Starting local Python Backend on port 8000...
start /b "" py "%~dp0desktop_main.py"

timeout /t 3 > nul

echo [2/2] Connecting to Cloudflare Global Edge Network...
echo.
echo =====================================================================
echo   YOUR LIVE PUBLIC LINK WILL APPEAR BELOW (look for https://...trycloudflare.com):
echo   Send this link to anyone on WhatsApp, email, or mobile Safari!
echo =====================================================================
echo.

"%~dp0cloudflared.exe" tunnel --url http://127.0.0.1:8000
pause
