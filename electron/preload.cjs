const { ipcRenderer, contextBridge } = require('electron');

console.log("Preload script running...");

try {
  contextBridge.exposeInMainWorld('electron', {
    desktopCapturer: {
      getSources: (opts) => ipcRenderer.invoke('GET_SOURCES', opts)
    },
    generateLiveKitToken: (roomName, participantName) => ipcRenderer.invoke('GET_LIVEKIT_TOKEN', { roomName, participantName })
  });
  console.log("ContextBridge exposed 'electron' successfully.");
} catch (e) {
  console.error("Error in preload:", e);
}
