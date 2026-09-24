@echo off
setlocal
cd /d "%~dp0"
if not exist "mobile-customer\node_modules\esbuild" (
  call npm ci --prefix mobile-customer
  if errorlevel 1 goto failed
)
echo Open http://127.0.0.1:8780/ zodra hieronder de ontwikkelomgeving klaar is.
echo Laat dit venster open tijdens het testen. Stoppen kan met Ctrl+C.
call npm run dev
if errorlevel 1 goto failed
exit /b 0
:failed
echo Starten is niet gelukt. Bekijk de melding hierboven.
pause
exit /b 1
