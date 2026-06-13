@echo off
title Helium Launcher

cd /d "%~dp0"

start "Helium Backend" cmd /k "py -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 3 /nobreak > nul

start "Helium Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 2 /nobreak > nul

start http://localhost:5173

exit