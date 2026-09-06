@echo off
cd /d "%~dp0"
echo.
echo ===== Educ.Pro IA =====
echo Carpeta: %CD%
echo.
if not exist package.json (
  echo ERROR: No se encontro package.json en esta carpeta.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando componentes necesarios...
  call npm install
  if errorlevel 1 (
    echo.
    echo No se pudo instalar. Revisá que Node.js este instalado.
    pause
    exit /b 1
  )
)
echo.
echo Iniciando Educ.Pro IA v18...
echo Si el puerto 3000 esta ocupado, la app buscara automaticamente otro puerto libre.
call npm start
pause
