@echo off
rem Double-click to start the game server and open the game. Close this window to stop it.
cd /d "%~dp0"
start "" http://127.0.0.1:5173
node server.js
pause
