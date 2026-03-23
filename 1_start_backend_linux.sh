#!/bin/bash

# ANSI Color Codes (0A equivalent is Light Green)
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "========================================="
echo -e "${GREEN}       Nomi Backend Services${NC}"
echo -e "========================================="

# 1. THE UV AUTO-INSTALLER
# Linux check for the activate script (path is slightly different than Windows)
if [ ! -f ".venv/bin/activate" ]; then
    echo -e "${GREEN}[Setup] First time run detected!${NC}"
    echo -e "${GREEN}[Setup] Setting up Python environment and dependencies...${NC}"
    
    # Using 'uv' which works cross-platform
    uv venv --python 3.10 .venv
    if [ $? -ne 0 ]; then
        echo -e "${RED}[ERROR] Failed to create environment.${NC}"
        read -p "Press enter to exit..."
        exit 1
    fi
    
    uv pip install -r requirements.txt
    
    echo -e "========================================================"
    echo -e "${YELLOW}[WARNING] Setup almost complete!${NC}"
    echo -e "Please open the .env.example file, rename it to .env,"
    echo -e "add your Nomi API keys, and run this launcher again!"
    echo -e "========================================================"
    read -p "Press enter to exit..."
    exit 0
fi

# 2. ACTIVATE THE ENVIRONMENT
source .venv/bin/activate

# 3. LAUNCH EVERYTHING
# Linux uses '&' to run processes in the background since it doesn't have 'start'
echo -e "${GREEN}[System] Starting Context Sensor...${NC}"
python vision_translator.py &

echo -e "${GREEN}[System] Starting Nomi Bridge...${NC}"
./bridge &

echo -e "${GREEN}[System] Starting VTuber Server...${NC}"
python run_server.py &

echo -e "========================================="
echo -e "${GREEN}[Success] Backend started!${NC}"
echo -e "You can now run ./start_frontend.sh once you see uvicorn running."
echo -e "========================================="

# Keep the script alive so the background processes don't die immediately
wait