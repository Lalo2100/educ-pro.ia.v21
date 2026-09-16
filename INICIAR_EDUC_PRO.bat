@echo off
setlocal
cd /d "%~dp0"
title Educ.Pro IA v21

echo.
echo ==================================================
echo              EDUC.PRO IA v21
echo ==================================================
echo.
if not exist package.json (
  echo ERROR: No se encontro package.json en esta carpeta.
  pause
  exit /b 1
)
if not defined GEMINI_API_KEY (
  echo La clave Gemini no esta cargada en esta ventana.
  echo.
  echo Para iniciar correctamente:
  echo 1. Ejecuta CONFIGURAR_GEMINI.bat
  echo 2. Ingresa tu nueva clave de Google AI Studio
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando componentes necesarios por primera vez...
  call npm install
  if errorlevel 1 (
    echo ERROR al instalar dependencias.
    pause
    exit /b 1
  )
)
set "AI_PROVIDER=gemini"
set "GEMINI_MODEL=gemini-3.8-flash"
set "PORT=3021"
start "Educ.Pro IA v21 - SERVIDOR" cmd /k "cd /d "%~dp0" && set AI_PROVIDER=gemini&&set GEMINI_MODEL=gemini-3.8-flash&&set GEMINI_API_KEY=%GEMINI_API_KEY%&&set PORT=3021&&npm start"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i-lt60;$i++){try{$c=New-Object Net.Sockets.TcpClient('127.0.0.1',3021);$c.Close();$ok=$true;break}catch{Start-Sleep -Milliseconds 500}}; if($ok){Start-Process 'http://localhost:3021';exit 0}else{exit 1}"
if errorlevel 1 echo No se pudo abrir http://localhost:3021. Revisa la ventana del servidor.
pause
endlocal
