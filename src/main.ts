import { app, BrowserWindow, ipcMain, Tray, Menu } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';
import Store from 'electron-store';
import AutoLaunch from 'auto-launch';
import * as fs from 'fs';

// Initialize store for settings
const store = new Store({
  defaults: {
    isEnabled: true,
    volume: 1.0,
    selectedSound: 'cherrymx-black-abs',
    autoStart: true
  }
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isEnabled = store.get('isEnabled') as boolean;
let currentSoundPath: string | null = null;
let currentSoundConfig: any = null;

// Initialize auto-launcher
const autoLauncher = new AutoLaunch({
  name: 'MechAura',
  path: app.getPath('exe'),
});

// Set up auto-launch based on settings
if (store.get('autoStart')) {
  autoLauncher.enable().catch(error => {
    console.log('Failed to enable auto-launch:', error);
  });
} else {
  autoLauncher.disable().catch(error => {
    console.log('Failed to disable auto-launch:', error);
  });
}

function loadSoundConfig(soundProfile: string) {
  try {
    const soundDir = path.join(__dirname, '../assets/sounds/audio', soundProfile);
    const configPath = path.join(soundDir, 'config.json');

    console.log('Checking sound configuration:', {
      soundProfile,
      soundDir,
      configPath,
      exists: fs.existsSync(configPath)
    });

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      // Handle different sound file structures
      let soundPath: string;
      if (fs.existsSync(path.join(soundDir, 'press'))) {
        // Travel kit case with press/release folders
        soundPath = path.join(soundDir, 'press', 'GENERIC_R0.mp3');
      } else if (config.sound) {
        // Single sound file case
        soundPath = path.join(soundDir, config.sound);
      } else {
        throw new Error(`No valid sound file found in ${soundDir}`);
      }

      console.log('Found sound configuration:', {
        configFile: config,
        soundPath,
        exists: fs.existsSync(soundPath)
      });

      if (!fs.existsSync(soundPath)) {
        throw new Error(`Sound file not found: ${soundPath}`);
      }

      return {
        type: 'mechvibes',
        config,
        soundPath: path.resolve(soundPath) // Use absolute path
      };
    }

    throw new Error(`No valid sound configuration found for profile: ${soundProfile}`);
  } catch (error) {
    console.error('Error loading sound config:', error);
    throw error;
  }
}

function loadSound(soundProfile = store.get('selectedSound') as string) {
  try {
    const soundConfig = loadSoundConfig(soundProfile);
    currentSoundConfig = soundConfig;
    currentSoundPath = soundConfig.soundPath;

    console.log('Loading sound configuration:', {
      profile: soundProfile,
      type: soundConfig.type,
      path: currentSoundPath,
      config: soundConfig
    });

    if (mainWindow) {
      mainWindow.webContents.send('load-sound', soundConfig);
    }

    return true;
  } catch (error) {
    console.error('Error loading sound:', error);
    return false;
  }
}

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

  tray.setToolTip('MechAura');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createTray();
  createWindow();

  // Start keyboard hook
  uIOhook.start();

  // Handle keyboard events
  uIOhook.on('keydown', () => {
    if (isEnabled && mainWindow) {
      mainWindow.webContents.send('play-sound', { keyCode: '1', isKeyUp: false });
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
  store.set('volume', value);
  if (mainWindow) {
    mainWindow.webContents.send('set-volume', value);
  }
});

ipcMain.on('set-auto-start', (_event, value: boolean) => {
  store.set('autoStart', value);
  if (value) {
    autoLauncher.enable().catch(error => {
      console.log('Failed to enable auto-launch:', error);
    });
  } else {
    autoLauncher.disable().catch(error => {
      console.log('Failed to disable auto-launch:', error);
    });
  }
}); 