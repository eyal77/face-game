@echo off
rem Stops the game server started by start.cmd (the node process listening on port 5173).
powershell -NoProfile -Command ^
  "$ids = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique;" ^
  "$node = $ids | ForEach-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue } | Where-Object ProcessName -eq 'node';" ^
  "if ($node) { $node | Stop-Process -Force; 'Face Runner server stopped.' } else { 'Face Runner server is not running.' }"
pause
