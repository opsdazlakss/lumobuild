const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

let splashWindow = null;
let mainWindow = null;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: path.join(__dirname, '../public/lumo-logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Load splash based on environment
  const isDev = !app.isPackaged;
  if (isDev) {
    splashWindow.loadFile(path.join(__dirname, '../public/splash.html'));
  } else {
    splashWindow.loadFile(path.join(__dirname, '../dist/splash.html'));
  }

  // Send version info
  splashWindow.webContents.on('did-finish-load', () => {
    const version = `v${app.getVersion()}`;
    splashWindow.webContents.send('version', version);
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    title: 'Lumo',
    frame: true,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../public/lumo-logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    backgroundColor: '#2c2b31',
  });

  mainWindow.setMenu(null);

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show main window and close splash when ready
  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
    }
    mainWindow.maximize(); // Start maximized
    mainWindow.show();
  });
}

function sendStatusToSplash(message) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('update-status', message);
  }
}

// Auto-updater events for splash window
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
  sendStatusToSplash('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  log.info('Update available.');
  sendStatusToSplash('Update found! Downloading...');
});

autoUpdater.on('update-not-available', (info) => {
  log.info('No update available.');
  sendStatusToSplash('Starting Lumo...');
  // Launch main app after short delay
  setTimeout(() => {
    createMainWindow();
  }, 500);
});

autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
  sendStatusToSplash('Starting Lumo...');
  // Launch main app even if update check fails
  setTimeout(() => {
    createMainWindow();
  }, 500);
});

autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  const transferred = (progressObj.transferred / 1024 / 1024).toFixed(1);
  const total = (progressObj.total / 1024 / 1024).toFixed(1);
  sendStatusToSplash(`Downloading update... ${transferred}/${total} MB (${percent}%)`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('download-progress', percent);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded.');
  sendStatusToSplash('Restarting to apply update...');
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 1500);
});

// App ready
app.whenReady().then(() => {
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // In development, skip splash and go directly to main window
    createMainWindow();
    mainWindow.show();
  } else {
    // In production, show splash and check for updates
    createSplashWindow();
    autoUpdater.checkForUpdates();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
