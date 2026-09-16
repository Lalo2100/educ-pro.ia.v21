@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Educ.Pro IA v21 - Configurar Gemini

echo.
echo ==================================================
echo       EDUC.PRO IA v21 - CONFIGURAR GEMINI
echo ==================================================
echo.
echo Esta ventana NO guarda la clave en el ZIP ni en GitHub.
echo La clave se usa solamente para iniciar este servidor.
echo.
set "GEMINI_API_KEY="
set /p "GEMINI_API_KEY=Pegá tu nueva clave Gemini y presioná ENTER: "
if not defined GEMINI_API_KEY (
  echo.
  echo No se ingreso ninguna clave.
  pause
  exit /b 1
)
set "AI_PROVIDER=gemini"
set "GEMINI_MODEL=gemini-3.8-flash"
set "PORT=3021"

echo.
echo Clave recibida. Iniciando Educ.Pro IA v21...
call npm install
if errorlevel 1 (
  echo.
  echo ERROR: no se pudieron instalar las dependencias.
  echo Verifica que Node.js y npm esten instalados.
  pause
  exit /b 1
)
start "Educ.Pro IA v21 - SERVIDOR GEMINI" cmd /k "cd /d "%~dp0" && set AI_PROVIDER=gemini&&set GEMINI_MODEL=gemini-3.8-flash&&set GEMINI_API_KEY=%GEMINI_API_KEY%&&set PORT=3021&&npm start"

echo Esperando al servidor...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i-lt60;$i++){try{$c=New-Object Net.Sockets.TcpClient('127.0.0.1',3021);$c.Close();$ok=$true;break}catch{Start-Sleep -Milliseconds 500}}; if($ok){Start-Process 'http://localhost:3021';exit 0}else{exit 1}"
if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor en http://localhost:3021
  echo Mira la ventana del servidor para ver el error exacto.
  pause
  exit /b 1
)

echo.
echo ==================================================
echo Educ.Pro IA v21 esta funcionando.
echo http://localhost:3021
echo ==================================================
echo.
echo NO cierres la ventana del servidor mientras uses la app.
pause
endlocal
