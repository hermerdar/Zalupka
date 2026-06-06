@echo off
chcp 65001 >nul
title Streamer.bot Overlay Manager
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [!] Node.js не найден.
  echo     Установи LTS-версию с https://nodejs.org и запусти этот файл снова.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo Создаю .env из .env.example ...
  copy /y ".env.example" ".env" >nul
)

if not exist "node_modules" (
  echo Устанавливаю зависимости (один раз, может занять минуту)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [!] Не удалось установить зависимости. Проверь интернет и попробуй снова.
    pause
    exit /b 1
  )
)

echo.
echo ============================================
echo   Запускаю Overlay Manager...
echo   Панель:  http://localhost:4848/
echo   Оверлей: http://localhost:4848/overlay
echo   (это окно не закрывай, пока стримишь)
echo ============================================
echo.
call npm start

pause
