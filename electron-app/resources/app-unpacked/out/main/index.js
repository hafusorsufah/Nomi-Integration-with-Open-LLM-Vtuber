"use strict";
const electron = require("electron");
const utils = require("@electron-toolkit/utils");
const path = require("path");
const isMac = process.platform === "darwin";
class WindowManager {
  constructor() {
    this.window = null;
    this.windowedBounds = null;
    this.hoveringComponents = /* @__PURE__ */ new Set();
    this.currentMode = "pet";
    this.forceIgnoreMouse = false;
    electron.ipcMain.on("renderer-ready-for-mode-change", (_event, newMode) => {
      if (newMode === "pet") {
        setTimeout(() => {
          this.continueSetWindowModePet();
        }, 500);
      } else {
        setTimeout(() => {
          this.continueSetWindowModeWindow();
        }, 500);
      }
    });
    electron.ipcMain.on("mode-change-rendered", () => {
      this.window?.setOpacity(1);
    });
    electron.ipcMain.on("window-unfullscreen", () => {
      const window = this.getWindow();
      if (window && window.isFullScreen()) {
        window.setFullScreen(false);
      }
    });
    electron.ipcMain.on("toggle-force-ignore-mouse", () => {
      this.toggleForceIgnoreMouse();
    });
  }
  createWindow(options) {
    // 1. Calculate the full bounding box of all connected monitors
    const displays = electron.screen.getAllDisplays();
    let minX = 0, minY = 0, maxX = 0, maxY = 0;

    displays.forEach(display => {
      const bounds = display.bounds;
      if (bounds.x < minX) minX = bounds.x;
      if (bounds.y < minY) minY = bounds.y;
      if (bounds.x + bounds.width > maxX) maxX = bounds.x + bounds.width;
      if (bounds.y + bounds.height > maxY) maxY = bounds.y + bounds.height;
    });

    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;

    // 2. Apply dimensions to the window
    this.window = new electron.BrowserWindow({
      x: minX,
      y: minY,
      width: totalWidth,
      height: totalHeight,
      show: false,
      transparent: true,
      backgroundColor: "#00000000", // Fully transparent hex to prevent white flashes
      autoHideMenuBar: true,
      frame: false,
      icon: process.platform === "win32" ? path.join(__dirname, "../../resources/icon.ico") : path.join(__dirname, "../../resources/icon.png"),
      ...typeof isMac !== 'undefined' && isMac ? { titleBarStyle: "hiddenInset" } : {},
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: true
      },
      hasShadow: false,
      paintWhenInitiallyHidden: true,
      ...options
    });

    this.window.webContents.openDevTools({ mode: 'detach' });
    this.setupWindowEvents();
    this.loadContent();

    this.window.on("enter-full-screen", () => {
      this.window?.webContents.send("window-fullscreen-change", true);
    });
    this.window.on("leave-full-screen", () => {
      this.window?.webContents.send("window-fullscreen-change", false);
    });

    return this.window;
  }

  setupWindowEvents() {
    if (!this.window) return;
    this.window.on("ready-to-show", () => {
      this.window?.show();
      this.window?.webContents.send(
        "window-maximized-change",
        this.window.isMaximized()
      );
    });
    this.window.on("maximize", () => {
      this.window?.webContents.send("window-maximized-change", true);
    });
    this.window.on("unmaximize", () => {
      this.window?.webContents.send("window-maximized-change", false);
    });

    this.window.on("resize", () => {
      const window = this.getWindow(); // Calling your existing method
      if (window) {
        const bounds = window.getBounds();
        
        // 3. Update the maximize check to use ALL displays instead of just the Primary
        const displays = electron.screen.getAllDisplays();
        let minX = 0, minY = 0, maxX = 0, maxY = 0;
        displays.forEach(d => {
          if (d.bounds.x < minX) minX = d.bounds.x;
          if (d.bounds.y < minY) minY = d.bounds.y;
          if (d.bounds.x + d.bounds.width > maxX) maxX = d.bounds.x + d.bounds.width;
          if (d.bounds.y + d.bounds.height > maxY) maxY = d.bounds.y + d.bounds.height;
        });
        const maxWidth = maxX - minX;
        const maxHeight = maxY - minY;

        // It is only "maximized" if it takes up the entire multi-monitor bounding box
        const isMaximized = bounds.width >= maxWidth && bounds.height >= maxHeight;
        window.webContents.send("window-maximized-change", isMaximized);
      }
    });

    this.window.webContents.setWindowOpenHandler((details) => {
      electron.shell.openExternal(details.url);
      return { action: "deny" };
    });
  }
  loadContent() {
    if (!this.window) return;
    if (utils.is.dev && process.env.ELECTRON_RENDERER_URL) {
      this.window.loadURL(process.env.ELECTRON_RENDERER_URL);
    } else {
      this.window.loadFile(path.join(__dirname, "../renderer/index.html"));
    }

    // 🚀 THE AUTOMATIC STARTUP SWITCH
    // Wait for the HTML/UI to finish loading its default Desktop view...
    this.window.webContents.once('did-finish-load', () => {
      // Give the Vue/React framework a tiny quarter-second to mount, 
      // then forcefully trigger the Pet Mode handshake!
      setTimeout(() => {
        this.setWindowMode("pet");
      }, 250); 
    });
  }
  setWindowMode(mode) {
    if (!this.window) return;
    
    // --- THE TIME-LOCK OVERRIDE ---
    // Record the exact millisecond the app starts booting
    if (this._startupTime === undefined) {
        this._startupTime = Date.now();
    }
    
    // For the first 3 seconds (3000ms), forcefully ignore the config file 
    // and lock the app into Pet Mode.
    if (Date.now() - this._startupTime < 3000) {
        mode = "pet";
    }
    
    this.currentMode = mode;
    this.window.setOpacity(0);
    
    if (mode === "window") {
      this.setWindowModeWindow();
    } else {
      this.setWindowModePet();
    }
  }
  setWindowModeWindow() {
    if (!this.window) return;
    this.window.setAlwaysOnTop(false);
    this.window.setIgnoreMouseEvents(false);
    this.window.setSkipTaskbar(false);
    this.window.setResizable(true);
    this.window.setFocusable(true);
    this.window.setAlwaysOnTop(false);
    this.window.setBackgroundColor("#ffffff");
    this.window.webContents.send("pre-mode-changed", "window");
  }
  continueSetWindowModeWindow() {
    if (!this.window) return;
    if (this.windowedBounds) {
      this.window.setBounds(this.windowedBounds);
    } else {
      this.window.setSize(900, 670);
      this.window.center();
    }
    if (isMac) {
      this.window.setWindowButtonVisibility(true);
      this.window.setVisibleOnAllWorkspaces(false, {
        visibleOnFullScreen: false
      });
    }
    this.window?.setIgnoreMouseEvents(false, { forward: true });
    this.window.webContents.send("mode-changed", "window");
  }
  setWindowModePet() {
    if (!this.window) return;
    this.windowedBounds = this.window.getBounds();
    if (this.window.isFullScreen()) {
      this.window.setFullScreen(false);
    }
    this.window.setBackgroundColor("#00000000");
    this.window.setAlwaysOnTop(true, "screen-saver");

    // FIX: Instead of 0,0 (Primary), we set it to the furthest top-left corner
    const displays = electron.screen.getAllDisplays();
    let minX = 0, minY = 0;
    displays.forEach(d => {
      if (d.bounds.x < minX) minX = d.bounds.x;
      if (d.bounds.y < minY) minY = d.bounds.y;
    });
    this.window.setPosition(minX, minY);

    this.window.webContents.send("pre-mode-changed", "pet");
  }
  continueSetWindowModePet() {
    if (!this.window) return;
    
    // FIX: Calculate the total width/height of all monitors combined
    const displays = electron.screen.getAllDisplays();
    let minX = 0, minY = 0, maxX = 0, maxY = 0;
    displays.forEach(d => {
      const b = d.bounds;
      if (b.x < minX) minX = b.x;
      if (b.y < minY) minY = b.y;
      if (b.x + b.width > maxX) maxX = b.x + b.width;
      if (b.y + b.height > maxY) maxY = b.y + b.height;
    });
    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;

    this.window.setSize(totalWidth, totalHeight);
    
    if (isMac) this.window.setWindowButtonVisibility(false);
    this.window.setResizable(false);
    this.window.setSkipTaskbar(true);
    this.window.setFocusable(false);
    if (isMac) {
      this.window.setIgnoreMouseEvents(true);
      this.window.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      });
    } else {
      this.window.setIgnoreMouseEvents(true, { forward: true });
    }
    this.window.webContents.send("mode-changed", "pet");
  }
  getWindow() {
    return this.window;
  }
  setIgnoreMouseEvents(ignore) {
    if (!this.window) return;
    if (isMac) {
      this.window.setIgnoreMouseEvents(ignore);
    } else {
      this.window.setIgnoreMouseEvents(ignore, { forward: true });
    }
  }
  maximizeWindow() {
    if (!this.window) return;
    if (this.isWindowMaximized()) {
      if (this.windowedBounds) {
        this.window.setBounds(this.windowedBounds);
        this.windowedBounds = null;
        this.window.webContents.send("window-maximized-change", false);
      }
    } else {
      this.windowedBounds = this.window.getBounds();
      
      // FIX: Maximize to the entire multi-monitor area
      const displays = electron.screen.getAllDisplays();
      let minX = 0, minY = 0, maxX = 0, maxY = 0;
      displays.forEach(d => {
        const b = d.bounds;
        if (b.x < minX) minX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.x + b.width > maxX) maxX = b.x + b.width;
        if (b.y + b.height > maxY) maxY = b.y + b.height;
      });
      
      this.window.setBounds({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      });
      this.window.webContents.send("window-maximized-change", true);
    }
  }
  isWindowMaximized() {
    if (!this.window) return false;
    const bounds = this.window.getBounds();
    
    // FIX: Check against the total multi-monitor area
    const displays = electron.screen.getAllDisplays();
    let maxX = 0, maxY = 0, minX = 0, minY = 0;
    displays.forEach(d => {
      if (d.bounds.x < minX) minX = d.bounds.x;
      if (d.bounds.y < minY) minY = d.bounds.y;
      if (d.bounds.x + d.bounds.width > maxX) maxX = d.bounds.x + d.bounds.width;
      if (d.bounds.y + d.bounds.height > maxY) maxY = d.bounds.y + d.bounds.height;
    });
    
    return bounds.width >= (maxX - minX) && bounds.height >= (maxY - minY);
  }
  updateComponentHover(componentId, isHovering) {
    if (this.currentMode === "window") return;
    if (this.forceIgnoreMouse) return;
    if (isHovering) {
      this.hoveringComponents.add(componentId);
    } else {
      this.hoveringComponents.delete(componentId);
    }
    if (this.window) {
      const shouldIgnore = this.hoveringComponents.size === 0;
      if (isMac) {
        this.window.setIgnoreMouseEvents(shouldIgnore);
      } else {
        this.window.setIgnoreMouseEvents(shouldIgnore, { forward: true });
      }
      if (!shouldIgnore) {
        this.window.setFocusable(true);
      }
    }
  }
  // Toggle force ignore mouse events
  toggleForceIgnoreMouse() {
    this.forceIgnoreMouse = !this.forceIgnoreMouse;
    if (this.forceIgnoreMouse) {
      if (isMac) {
        this.window?.setIgnoreMouseEvents(true);
      } else {
        this.window?.setIgnoreMouseEvents(true, { forward: true });
      }
    } else {
      const shouldIgnore = this.hoveringComponents.size === 0;
      if (isMac) {
        this.window?.setIgnoreMouseEvents(shouldIgnore);
      } else {
        this.window?.setIgnoreMouseEvents(shouldIgnore, { forward: true });
      }
    }
    this.window?.webContents.send("force-ignore-mouse-changed", this.forceIgnoreMouse);
  }
  // Get current force ignore state
  isForceIgnoreMouse() {
    return this.forceIgnoreMouse;
  }
  // Get current mode
  getCurrentMode() {
    return this.currentMode;
  }
}
const trayIcon = path.join(__dirname, "../../resources/icon.png");
class MenuManager {
  constructor(onModeChange) {
    this.onModeChange = onModeChange;
    this.tray = null;
    this.currentMode = "window";
    this.configFiles = [];
    this.setupContextMenu();
  }
  createTray() {
    const icon = electron.nativeImage.createFromPath(trayIcon);
    const trayIconResized = icon.resize({
      width: process.platform === "win32" ? 16 : 18,
      height: process.platform === "win32" ? 16 : 18
    });
    this.tray = new electron.Tray(trayIconResized);
    this.updateTrayMenu();
  }
  getModeMenuItems() {
    return [
      {
        label: "Window Mode",
        type: "radio",
        checked: this.currentMode === "window",
        click: () => {
          this.setMode("window");
        }
      },
      {
        label: "Pet Mode",
        type: "radio",
        checked: this.currentMode === "pet",
        click: () => {
          this.setMode("pet");
        }
      }
    ];
  }
  updateTrayMenu() {
    if (!this.tray) return;
    const contextMenu = electron.Menu.buildFromTemplate([
      ...this.getModeMenuItems(),
      { type: "separator" },
      // Only show toggle mouse ignore in pet mode
      ...this.currentMode === "pet" ? [
        {
          label: "Toggle Mouse Passthrough",
          click: () => {
            const windows = electron.BrowserWindow.getAllWindows();
            windows.forEach((window) => {
              window.webContents.send("toggle-force-ignore-mouse");
            });
          }
        },
        { type: "separator" }
      ] : [],
      {
        label: "Show",
        click: () => {
          const windows = electron.BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.show();
          });
        }
      },
      {
        label: "Hide",
        click: () => {
          const windows = electron.BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.hide();
          });
        }
      },
      {
        label: "Exit",
        click: () => {
          electron.app.quit();
        }
      }
    ]);
    this.tray.setToolTip("Open LLM VTuber");
    this.tray.setContextMenu(contextMenu);
  }
  getContextMenuItems(event) {
    const template = [
      {
        label: "Toggle Microphone",
        click: () => {
          event.sender.send("mic-toggle");
        }
      },
      {
        label: "Interrupt",
        click: () => {
          event.sender.send("interrupt");
        }
      },
      { type: "separator" },
      // Only show in pet mode
      ...this.currentMode === "pet" ? [
        {
          label: "Toggle Mouse Passthrough",
          click: () => {
            event.sender.send("toggle-force-ignore-mouse");
          }
        }
      ] : [],
      {
        label: "Toggle Scrolling to Resize",
        click: () => {
          event.sender.send("toggle-scroll-to-resize");
        }
      },
      // Only show this item in pet mode
      ...this.currentMode === "pet" ? [
        {
          label: "Toggle InputBox and Subtitle",
          click: () => {
            event.sender.send("toggle-input-subtitle");
          }
        }
      ] : [],
      { type: "separator" },
      ...this.getModeMenuItems(),
      { type: "separator" },
      {
        label: "Switch Character",
        visible: this.currentMode === "pet",
        submenu: this.configFiles.map((config) => ({
          label: config.name,
          click: () => {
            event.sender.send("switch-character", config.filename);
          }
        }))
      },
      { type: "separator" },
      {
        label: "Hide",
        click: () => {
          const windows = electron.BrowserWindow.getAllWindows();
          windows.forEach((window) => {
            window.hide();
          });
        }
      },
      {
        label: "Exit",
        click: () => {
          electron.app.quit();
        }
      }
    ];
    return template;
  }
  setupContextMenu() {
    electron.ipcMain.on("show-context-menu", (event) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        const screenPoint = electron.screen.getCursorScreenPoint();
        const menu = electron.Menu.buildFromTemplate(this.getContextMenuItems(event));
        menu.popup({
          window: win,
          x: Math.round(screenPoint.x),
          y: Math.round(screenPoint.y)
        });
      }
    });
  }
  setMode(mode) {
    this.currentMode = mode;
    this.updateTrayMenu();
    this.onModeChange(mode);
  }
  destroy() {
    this.tray?.destroy();
    this.tray = null;
  }
  updateConfigFiles(files) {
    this.configFiles = files;
  }
}
let windowManager;
let menuManager;
let isQuitting = false;
function setupIPC() {
  electron.ipcMain.handle("get-platform", () => process.platform);
  electron.ipcMain.on("set-ignore-mouse-events", (_event, ignore) => {
    const window = windowManager.getWindow();
    if (window) {
      windowManager.setIgnoreMouseEvents(ignore);
    }
  });
  electron.ipcMain.on("get-current-mode", (event) => {
    event.returnValue = windowManager.getCurrentMode();
  });
  electron.ipcMain.on("pre-mode-changed", (_event, newMode) => {
    if (newMode === "window" || newMode === "pet") {
      menuManager.setMode(newMode);
    }
  });
  electron.ipcMain.on("window-minimize", () => {
    windowManager.getWindow()?.minimize();
  });
  electron.ipcMain.on("window-maximize", () => {
    const window = windowManager.getWindow();
    if (window) {
      windowManager.maximizeWindow();
    }
  });
  electron.ipcMain.on("window-close", () => {
    const window = windowManager.getWindow();
    if (window) {
      if (process.platform === "darwin") {
        window.hide();
      } else {
        window.close();
      }
    }
  });
  electron.ipcMain.on(
    "update-component-hover",
    (_event, componentId, isHovering) => {
      windowManager.updateComponentHover(componentId, isHovering);
    }
  );
  electron.ipcMain.handle("get-config-files", () => {
    const configFiles = JSON.parse(localStorage.getItem("configFiles") || "[]");
    menuManager.updateConfigFiles(configFiles);
    return configFiles;
  });
  electron.ipcMain.on("update-config-files", (_event, files) => {
    menuManager.updateConfigFiles(files);
  });
  electron.ipcMain.handle("get-screen-capture", async () => {
    const sources = await electron.desktopCapturer.getSources({ types: ["screen"] });
    return sources[0].id;
  });
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  windowManager = new WindowManager();
  menuManager = new MenuManager((mode) => windowManager.setWindowMode(mode));
  const window = windowManager.createWindow({
    titleBarOverlay: {
      color: "#111111",
      symbolColor: "#FFFFFF",
      height: 30
    }
  });
  menuManager.createTray();
  window.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      window.hide();
    }
    return false;
  });
  setupIPC();
  electron.app.on("activate", () => {
    const window2 = windowManager.getWindow();
    if (window2) {
      window2.show();
    }
  });
  electron.app.on("browser-window-created", (_, window2) => {
    utils.optimizer.watchWindowShortcuts(window2);
  });
  electron.app.on("web-contents-created", (_, contents) => {
    contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === "media") {
        callback(true);
      } else {
        callback(false);
      }
    });
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  isQuitting = true;
  menuManager.destroy();
  electron.globalShortcut.unregisterAll();
});
