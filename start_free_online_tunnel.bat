@echo off
chcp 65001 > nul
echo =====================================================================
echo   Clinical Decision Support - Free Online Tunnel (100%% Free)
echo =====================================================================
echo.
echo [1/2] Starting local Python AI Backend on port 8000...
start /b "" py "C:\Users\I-FiX\Headache-Chatbot\desktop_main.py"

timeout /t 3 > nul

echo [2/2] Generating your free public HTTPS link via localtunnel...
echo.
echo =====================================================================
echo   COPY THE URL SHOWN BELOW (e.g. https://xxxx.loca.lt)
echo   And paste it into your GitHub Pages website Settings (Gear Icon)!
echo =====================================================================
echo.

cmd /c "npx --yes localtunnel --port 8000"
pause
