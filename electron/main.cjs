const { app, BrowserWindow, dialog, desktopCapturer, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// Global state
let splashWindow = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

// ... (existing code handles)

// IPC Handler for Screen Sources (Modern/Secure approach)
ipcMain.handle('GET_SOURCES', async (event, opts) => {
  try {
    const sources = await desktopCapturer.getSources(opts);
    // NativeImage serialization via IPC works, but let's be safe and return what we need.
    // Serialization of nativeImage is handled by Electron.
    return sources;
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
});


// ... (existing code) ...

function createTray() {
  const iconPath = path.join(__dirname, '../public/lumo-logo.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Lumo');

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Open Lumo', 
      click: () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
      } 
    },
    { type: 'separator' },
    { 
      label: 'Quit Lumo', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
        if (mainWindow.isVisible()) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            } else {
                mainWindow.focus();
            }
        } else {
            mainWindow.show();
        }
    }
  });

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
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
      sandbox: false, // Ensure Node integration works reliably
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    backgroundColor: '#2c2b31',
  });

  // Enable Screen Sharing (getDisplayMedia)
  // Fallback Handler: If Renderer fails to specify a sourceId (detection fail),
  // this handler picks the first screen to prevent 'NotSupportedError'.
  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // Grant access to the first screen available
      if (sources.length > 0) {
          callback({ video: sources[0], audio: 'loopback' });
      } else {
          // No screen found
          callback({ video: null, audio: null });
      }
    }).catch(err => {
      console.error('Screen capture error:', err);
      callback({ video: null, audio: null });
    });
  });

  mainWindow.setMenu(null);

  // Handle Minimize to Tray
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  const isDev = !app.isPackaged;
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
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
// Configure logging
log.transports.file.level = 'info';
autoUpdater.logger = log;

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
    createTray(); // Create Tray
  }, 500);
});

autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
  sendStatusToSplash('Starting Lumo...');
  // Launch main app even if update check fails
  setTimeout(() => {
    createMainWindow();
    createTray(); // Create Tray
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
    createTray(); // Create Tray in Dev
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
  
  // Before quit handler to ensure we allow quitting
  app.on('before-quit', () => {
      isQuitting = true;
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
