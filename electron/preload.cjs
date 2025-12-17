const { ipcRenderer } = require('electron');

// Since contextIsolation is false in your main.cjs, we can just attach to window
window.electron = {
  desktopCapturer: {
    getSources: (opts) => ipcRenderer.invoke('GET_SOURCES', opts)
  }
};
