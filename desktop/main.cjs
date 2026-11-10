'use strict';
/**
 * ГРОТ Windows: локальная настольная оболочка без удалённого сервера.
 * Профиль Chromium (localStorage) хранится в app.getPath('userData').
 * Адрес grot://local/grot/ постоянный — браузерное хранилище сохраняется
 * между перезапусками и обновлениями программы.
 */
const {app, BrowserWindow, protocol, shell, dialog} = require('electron');
const {readFile} = require('node:fs/promises');
const {mkdirSync, mkdtempSync, rmSync} = require('node:fs');
const path = require('node:path');

const APP_SCHEME = 'grot';
const APP_HOST = 'local';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const APP_ENTRY = `${APP_ORIGIN}/grot/index.html`;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf'
};

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true}
}]);

// Только сборка Portable получает PORTABLE_EXECUTABLE_DIR от electron-builder.
 // Хранилище расположено рядом с EXE на флешке, а не в %APPDATA% рабочего ПК.
 // При недоступности записи завершать запуск, не переключаясь молча на ПК.
 const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
 if (portableDir && process.platform === 'win32') {
   const portableDataDir = path.join(portableDir, 'ГРОТ-Данные');
   try {
     mkdirSync(portableDataDir, {recursive: true});
     const probe = mkdtempSync(path.join(portableDataDir, '.write-check-'));
     rmSync(probe, {recursive: true, force: true});
     app.setPath('userData', portableDataDir);
   } catch (error) {
     dialog.showErrorBox(
       'ГРОТ Portable — нельзя сохранить данные',
       'Нет доступа к записи в папку «ГРОТ-Данные» рядом с программой. ' +
       'Проверьте флешку и права доступа. Программа не будет запущена, чтобы не потерять данные.\\n\\n' +
       String(error.message || error)
     );
     process.exit(1);
   }
 }
 
 let mainWindow = null;
 app.setName('ГРОТ');
app.setAppUserModelId('ru.grot.vacation.desktop');

app.whenReady().then(async () => {
  const root = path.resolve(__dirname, '..', 'dist');
  protocol.handle(APP_SCHEME, async request => {
    try {
      const url = new URL(request.url);
      if (url.host !== APP_HOST || !url.pathname.startsWith('/grot/')) {
        return new Response('Адрес недоступен', {status: 404});
      }
      const requested = decodeURIComponent(url.pathname.slice('/grot/'.length));
      const relative = requested === '' ? 'index.html' : requested;
      const absolute = path.resolve(root, relative);
      if (absolute !== root && !absolute.startsWith(root + path.sep)) {
        return new Response('Доступ запрещён', {status: 403});
      }
      const data = await readFile(absolute);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': contentTypes[path.extname(absolute).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      });
    } catch {
      return new Response('Файл не найден', {status: 404});
    }
  });

  // Все основные данные ГРОТ остаются в локальном профиле пользователя Windows.
  const {defaultSession} = require('electron').session;
  defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'clipboard-read' || permission === 'clipboard-sanitized-write');
  });

  mainWindow = new BrowserWindow({
    width: 1460, height: 940, minWidth: 960, minHeight: 630,
    show: false,
    title: 'ГРОТ — график отпусков · ПК',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  // Отдельные окна печати, открываемые самим приложением, остаются доступны.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_ORIGIN + '/grot/')) {
      event.preventDefault();
      if (/^https:\/\//i.test(url)) shell.openExternal(url);
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  await mainWindow.loadURL(APP_ENTRY);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) app.relaunch(), app.exit();
});
