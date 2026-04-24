// Electron preload — 安全的上下文桥接
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    isElectron: true,
});
