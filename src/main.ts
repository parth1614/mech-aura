import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import { Howl } from 'howler';
import Store from 'electron-store';
import AutoLaunch from 'auto-launch';

// Initialize store for settings
const store = new Store({
  defaults: {
    isEnabled: true,
    volume: 1.0,
    selectedSound: 'cherry-mx-blue',
    autoStart: true
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isEnabled = store.get('isEnabled') as boolean;

// Initialize auto-launcher
const autoLauncher = new AutoLaunch({
  name: 'MechNerd',
  path: app.getPath('exe'),
});

// Set up auto-launch based on settings
if (store.get('autoStart')) {
  autoLauncher.enable();
} else {
  autoLauncher.disable();
}

// Initialize sound
const sound = new Howl({
  src: [path.join(__dirname, '../assets/sounds/cherry-mx-blue.mp3')],
  volume: store.get('volume') as number
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));
}

function createTray() {
  tray = new Tray(path.join(__dirname, '../assets/icon.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Enabled',
      type: 'checkbox',
      checked: isEnabled,
      click: () => {
        isEnabled = !isEnabled;
        store.set('isEnabled', isEnabled);
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('MechNerd');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createTray();
  createWindow();

  // Start keyboard hook
  uIOhook.start();

  // Handle keyboard events
  uIOhook.on('keydown', () => {
    if (isEnabled) {
      sound.play();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for settings
ipcMain.on('toggle-enabled', (_event, value: boolean) => {
  isEnabled = value;
  store.set('isEnabled', value);
});

ipcMain.on('set-volume', (_event, value: number) => {
  sound.volume(value);
  store.set('volume', value);
});

ipcMain.on('set-auto-start', (_event, value: boolean) => {
  store.set('autoStart', value);
  if (value) {
    autoLauncher.enable();
  } else {
    autoLauncher.disable();
  }
}); 