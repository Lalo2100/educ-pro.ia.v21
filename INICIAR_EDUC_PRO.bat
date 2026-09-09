@echo off
setlocal
cd /d "%~dp0"
title Educ.Pro IA v21

echo.
echo ==================================================
echo              EDUC.PRO IA v21
echo ==================================================
echo Carpeta: %CD%
echo.

if not exist package.json (
  echo ERROR: No se encontro package.json en esta carpeta.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando componentes necesarios por primera vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo No se pudo instalar. Verifica que Node.js este instalado.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando Educ.Pro IA v21 en un puerto exclusivo para esta version...
set "PORT=3021"

rem Arranca el servidor en una ventana propia para no mezclarlo con otras versiones.
start "Educ.Pro IA v21 - SERVIDOR" cmd /c "set PORT=3021&&npm start"

echo Esperando al servidor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 30;$i++){ try { $c=New-Object Net.Sockets.TcpClient('127.0.0.1',3021); $c.Close(); $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if($ok){ Start-Process 'http://localhost:3021'; exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo.
  echo No se pudo abrir Educ.Pro IA v21 automaticamente.
  echo Probá manualmente: http://localhost:3021
  pause
  exit /b 1
)

echo.
echo Educ.Pro IA v21 esta funcionando en:
echo http://localhost:3021
echo.
echo NO cierres la ventana del servidor mientras uses la app.
pause
endlocal
