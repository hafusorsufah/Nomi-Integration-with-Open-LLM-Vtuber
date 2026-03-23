"use strict";
const electron = require("electron");
const preload = require("@electron-toolkit/preload");
const { contextBridge, ipcRenderer, desktopCapturer } = electron;
const api = {
  setIgnoreMouseEvents: (ignore) => {
    ipcRenderer.send("set-ignore-mouse-events", ignore);
  },
  toggleForceIgnoreMouse: () => {
    ipcRenderer.send("toggle-force-ignore-mouse");
  },
  onForceIgnoreMouseChanged: (callback) => {
    const handler = (_event, isForced) => callback(isForced);
    ipcRenderer.on("force-ignore-mouse-changed", handler);
    return () => ipcRenderer.removeListener("force-ignore-mouse-changed", handler);
  },
  showContextMenu: () => {
    console.log("Preload showContextMenu");
    ipcRenderer.send("show-context-menu");
  },
  onModeChanged: (callback) => {
    ipcRenderer.on("mode-changed", (_, mode) => callback(mode));
  },
  onMicToggle: (callback) => {
    const handler = (_event) => callback();
    ipcRenderer.on("mic-toggle", handler);
    return () => ipcRenderer.removeListener("mic-toggle", handler);
  },
  onInterrupt: (callback) => {
    const handler = (_event) => callback();
    ipcRenderer.on("interrupt", handler);
    return () => ipcRenderer.removeListener("interrupt", handler);
  },
  updateComponentHover: (componentId, isHovering) => {
    ipcRenderer.send("update-component-hover", componentId, isHovering);
  },
  onToggleInputSubtitle: (callback) => {
    const handler = (_event) => callback();
    ipcRenderer.on("toggle-input-subtitle", handler);
    return () => ipcRenderer.removeListener("toggle-input-subtitle", handler);
  },
  onToggleScrollToResize: (callback) => {
    const handler = (_event) => callback();
    ipcRenderer.on("toggle-scroll-to-resize", handler);
    return () => ipcRenderer.removeListener("toggle-scroll-to-resize", handler);
  },
  onSwitchCharacter: (callback) => {
    const handler = (_event, filename) => callback(filename);
    ipcRenderer.on("switch-character", handler);
    return () => ipcRenderer.removeListener("switch-character", handler);
  },
  setMode: (mode) => {
    ipcRenderer.send("pre-mode-changed", mode);
  },
  getConfigFiles: () => ipcRenderer.invoke("get-config-files"),
  updateConfigFiles: (files) => {
    ipcRenderer.send("update-config-files", files);
  }
};
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", {
      ...preload.electronAPI,
      desktopCapturer: {
        getSources: (options) => desktopCapturer.getSources(options)
      },
      ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        on: (channel, func) => ipcRenderer.on(channel, func),
        once: (channel, func) => ipcRenderer.once(channel, func),
        removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
        send: (channel, ...args) => ipcRenderer.send(channel, ...args)
      },
      process: {
        platform: process.platform
      }
    });
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  window.electron = preload.electronAPI;
  window.api = api;
}
