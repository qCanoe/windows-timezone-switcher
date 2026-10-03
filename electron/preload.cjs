const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('timezone', {
 preferences:ipcRenderer.sendSync('preferences:bootstrap'),
 onActivity:callback=>{const listener=(_,active)=>callback(active);ipcRenderer.on('panel:activity',listener);return()=>ipcRenderer.removeListener('panel:activity',listener);},
 readPreferences:()=>ipcRenderer.invoke('preferences:read'),
 updatePreferences:patch=>ipcRenderer.invoke('preferences:update',patch),
 onOpenPreferences:callback=>{const listener=()=>callback();ipcRenderer.on('preferences:open',listener);return()=>ipcRenderer.removeListener('preferences:open',listener);},
 read: () => ipcRenderer.invoke('zones:read'),
 switch: (id, elevated = false) => ipcRenderer.invoke('zones:switch', id, elevated),
 hide: () => ipcRenderer.send('panel:hide'),
 settings: () => ipcRenderer.send('settings:open'),
 onRefresh: callback => { const listener = () => callback(); ipcRenderer.on('zones:refresh', listener); return () => ipcRenderer.removeListener('zones:refresh', listener); }
});
