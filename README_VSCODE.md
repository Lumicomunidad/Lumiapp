# Ejecutar Lumi en Visual Studio Code (VSCodeUserSetup)

Esta carpeta contiene toda la aplicación completa de **Lumi** (React + Express + motor de transformación de mensajes para el receptor + cuentas de usuario + simulador LumiCube + IA Gemini opcional).

## Requisitos previos (una sola vez en Windows)
1. Tener instalado **Node.js 20 o superior** (https://nodejs.org — descarga la versión LTS).
2. Tener instalado **Visual Studio Code** (`VSCodeUserSetup`).

## Pasos rápidos para abrir y ejecutar en VS Code
1. Descarga esta carpeta del proyecto desde Google AI Studio (botón **Download** / descargar ZIP) y descomprímela en tu computador (por ejemplo en `Documentos\LumiApp`).
2. Abre **Visual Studio Code**, ve a **Archivo > Abrir carpeta...** y selecciona la carpeta `LumiApp`.
3. Abre la terminal integrada en VS Code con **`Ctrl + Ñ`** (o menú **Terminal > Nuevo terminal**).
4. Ejecuta estos dos comandos:
   ```bash
   npm install
   npm run dev
   ```
5. Abre tu navegador en **`http://localhost:3000`**.

### Atajos incluidos para VS Code
- **Presiona `F5`**: ejecuta Lumi automáticamente usando `.vscode/launch.json`.
- **Presiona `Ctrl + Shift + B`**: inicia el servidor con `.vscode/tasks.json`.
- **Doble clic en `ejecutar-lumi.bat`** (en Windows): instala dependencias si faltan, abre `http://localhost:3000` e inicia la aplicación.

## Configuración opcional de IA Gemini
Si deseas activar las respuestas generativas avanzadas del Asistente Lumi, Traductor IA y Narración HD:
1. Copia `.env.example` y renómbralo a `.env`.
2. Coloca tu clave en `GEMINI_API_KEY="TU_CLAVE"`.
3. Sin clave también funciona toda la app con transformaciones accesibles locales, cuentas de usuario, mensajes, red social, lengua de señas, audiolibros (con voz del navegador) y LumiCube.
