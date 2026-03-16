@echo off
title Nomi Backend Launcher
color 0A

echo =========================================
echo        Nomi Backend Services
echo =========================================

:: 1. THE UV AUTO-INSTALLER
if not exist ".venv\Scripts\activate.bat" (
    echo [Setup] First time run detected! 
    echo [Setup] Downloading portable Python and installing dependencies...
    
    uv venv --python 3.10 .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create environment.
        pause
        exit /b
    )
    
    uv pip install -r requirements.txt
    
    echo ========================================================
    echo [WARNING] Setup almost complete! 
    echo Please open the .env.example file, rename it to .env, 
    echo add your Nomi API keys, and run this launcher again!
    echo ========================================================
    pause
    exit /b
)

:: 2. ACTIVATE THE PORTABLE ENVIRONMENT
call .venv\Scripts\activate.bat

:: 3. LAUNCH EVERYTHING (Using /k so windows stay open to read errors!)
echo [System] Starting Context Sensor...
start "Context Sensor" cmd /k "vision_translator.exe"

echo [System] Starting Nomi Bridge...
start "Nomi Bridge" cmd /k "bridge.exe"

echo [System] Starting VTuber Server...
start "VTuber Server" cmd /k "python run_server.py"

echo [Success] Backend started! Check the 3 new windows for errors.
echo You can now run 2_Start_Frontend.bat once the server is fully loaded.
exit