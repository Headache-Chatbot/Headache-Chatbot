@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

echo ================================================================================
echo   Clinical Decision Support System - NICE CG150
echo ================================================================================
echo.

REM -- Locate Python --
set PYTHON=
for %%P in (python python3 py) do (
    if not defined PYTHON (
        where %%P >nul 2>&1
        if !errorlevel!==0 set PYTHON=%%P
    )
)

if not defined PYTHON (
    echo.
    echo [ERROR] Python was not found on this computer.
    echo.
    echo  1. Download Python from: https://www.python.org/downloads/
    echo  2. Run the installer
    echo  3. IMPORTANT: Tick "Add Python to PATH" during install
    echo  4. Re-run this file
    echo.
    pause & exit /b 1
)

for /f "tokens=*" %%V in ('!PYTHON! --version 2^>^&1') do set PYVER=%%V
echo [OK] Found: !PYVER!
echo.

set REPO=%~dp0
if "%REPO:~-1%"=="\" set REPO=%REPO:~0,-1%
echo [INFO] App folder: %REPO%
echo.

REM -- Check data files --
if not exist "%REPO%\data\medical_rag.faiss" (
    echo [ERROR] Data files missing from %REPO%\data\
    echo.
    echo  You need these 3 files in the data\ folder:
    echo    data\medical_rag.faiss
    echo    data\medical_rag_chunks.pkl
    echo    data\medical_rag_embeddings.npy
    echo.
    echo  Get them from the shared drive and paste into the data\ folder.
    echo.
    pause & exit /b 1
)
echo [OK] Data files found.
echo.

REM -- Install Python packages --
echo [1/4] Installing Python packages (first run takes a few minutes)...

REM  Install torch CPU-only first (much smaller than default - 200 MB vs 2 GB)
!PYTHON! -m pip install --quiet --upgrade pip
!PYTHON! -m pip install --quiet torch --index-url https://download.pytorch.org/whl/cpu
if !errorlevel! neq 0 (
    echo [WARN] CPU-only torch install failed, trying standard torch...
    !PYTHON! -m pip install --quiet torch
)

REM  Install everything else
!PYTHON! -m pip install --quiet fastapi "uvicorn[standard]" faiss-cpu rank_bm25 transformers numpy pillow google-generativeai
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Failed to install packages. Check your internet connection.
    echo.
    pause & exit /b 1
)
echo [OK] Packages installed.
echo.

REM -- Download AI model (first time only) --
echo [2/4] Setting up AI model...
!PYTHON! "%REPO%\setup_model.py"
echo.

REM -- Optional frontend rebuild --
where npm >nul 2>&1
if !errorlevel!==0 (
    if not exist "%REPO%\frontend\node_modules\" (
        echo [3/4] Installing frontend packages...
        pushd "%REPO%\frontend"
        npm install --silent 2>nul
        npm run build --silent 2>nul
        popd
        echo [OK] Frontend ready.
    ) else (
        echo [3/4] Frontend already built.
    )
) else (
    echo [3/4] Using pre-built frontend.
)
echo.

echo [4/4] Starting the application...
echo       Your browser will open automatically at http://127.0.0.1:8000
echo.
echo ================================================================================
echo   Accounts:  admin / #1234$   or   user1, user2, user3 / #1234$
echo   To stop:   close this window or press Ctrl+C
echo ================================================================================
echo.

!PYTHON! "%REPO%\desktop_main.py"

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Application crashed (code: !errorlevel!)
    echo  - Make sure no other copy of the app is already running
    echo  - Read the error messages above for details
    echo.
)

pause
