@echo off
title Lumi - Comunicacion Accesible y LumiCube
echo ============================================
echo   Iniciando Lumi en tu computador (Windows)
echo ============================================
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
)
if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    echo Archivo .env creado desde .env.example
  )
)
echo Abriendo Lumi en http://localhost:3000 ...
start "" http://localhost:3000
call npm run dev
pause
