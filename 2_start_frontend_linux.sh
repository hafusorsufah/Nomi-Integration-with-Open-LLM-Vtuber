#!/bin/bash

# ANSI Color Codes 
CYAN='\033[0;36m'
NC='\033[0m' 

echo -e "========================================="
echo -e "${CYAN}       Launching Nomi Avatar...${NC}"
echo -e "========================================="

# Navigate to the directory and run the binary
# Note: Linux binaries usually don't have .exe extensions.
# If you package for Linux, the file will likely be named 'open-llm-vtuber-electron'
cd electron-app
chmod +x open-llm-vtuber-electron
./open-llm-vtuber-electron &

exit