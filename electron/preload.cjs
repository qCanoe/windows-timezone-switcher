const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('timezone', {
 read: () => ipcRenderer.invoke('zones:read'),
 switch: (id, elevated = false) => ipcRenderer.invoke('zones:switch', id, elevated),
 hide: () => ipcRenderer.send('panel:hide'),
 settings: () => ipcRenderer.send('settings:open'),
 onRefresh: callback => { const listener = () => callback(); ipcRenderer.on('zones:refresh', listener); return () => ipcRenderer.removeListener('zones:refresh', listener); }
});
