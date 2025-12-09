const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    title: 'Lumo',
    frame: true, // We can set this to false later for custom title bar
    autoHideMenuBar: true, // Hide the default menu bar (File, Edit, etc.)
    icon: path.join(__dirname, '../public/lumo-logo.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simpler dev, consider secure defaults for prod
    },
    backgroundColor: '#2c2b31', // Lumo dark background
  });

  // Load the app
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
    console.log('Running in development mode');
  } else {
    // In production, load the built index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    console.log('Running in production mode');
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
