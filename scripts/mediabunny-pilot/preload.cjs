const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pilot', {
  begin: (filePath) => ipcRenderer.invoke('pilot:begin', filePath),
  write: (chunk) => ipcRenderer.invoke('pilot:write', chunk),
  end: (report) => ipcRenderer.invoke('pilot:end', report),
  fail: (message) => ipcRenderer.invoke('pilot:fail', message)
})
