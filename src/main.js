const { app, BrowserWindow, ipcMain, Tray, Menu, dialog } = require('electron');
const path = require('path');
const { uIOhook } = require('uiohook-napi');
const Store = require('electron-store');
const AutoLaunch = require('auto-launch');
const fs = require('fs');

// Initialize store for settings
const store = new Store({
  defaults: {
    isEnabled: true,
    volume: 1.0,
    selectedSound: 'cherry-mx-black-abs',
    autoStart: true
  }
});

let mainWindow = null;
let tray = null;
let isEnabled = store.get('isEnabled');
let currentSoundPath = null;
let currentSoundConfig = null;

// Initialize auto-launcher with error handling
let autoLauncher = null;
try {
  autoLauncher = new AutoLaunch({
    name: 'MechNerd',
    path: process.execPath,
    isHidden: true
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
} catch (error) {
  console.log('Failed to initialize auto-launch:', error);
}

// Create a simple click sound file as fallback
function createClickSound() {
  const soundsDir = path.join(__dirname, '../assets/sounds');
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true });
  }

  // WAV file header for a simple click sound
  const header = Buffer.from([
    // RIFF chunk
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x24, 0x00, 0x00, 0x00, // File size - 36 (to be filled)
    0x57, 0x41, 0x56, 0x45, // "WAVE"

    // fmt chunk
    0x66, 0x6D, 0x74, 0x20, // "fmt "
    0x10, 0x00, 0x00, 0x00, // Chunk size (16)
    0x01, 0x00,             // Audio format (1 = PCM)
    0x01, 0x00,             // Number of channels (1)
    0x44, 0xAC, 0x00, 0x00, // Sample rate (44100)
    0x88, 0x58, 0x01, 0x00, // Byte rate (44100 * 2)
    0x02, 0x00,             // Block align
    0x10, 0x00,             // Bits per sample (16)

    // data chunk
    0x64, 0x61, 0x74, 0x61, // "data"
    0x00, 0x00, 0x00, 0x00  // Data size (to be filled)
  ]);

  // Create a simple click waveform (a short sine wave burst)
  const samples = [];
  const sampleRate = 44100;
  const duration = 0.01; // 10ms
  const frequency = 2000; // 2kHz

  for (let i = 0; i < sampleRate * duration; i++) {
    // Create a decaying sine wave
    const decay = Math.exp(-i / (sampleRate * 0.003));
    const value = Math.sin(2 * Math.PI * frequency * i / sampleRate) * decay * 32767;
    samples.push(Math.floor(value));
  }

  // Convert samples to buffer
  const dataBuffer = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    dataBuffer.writeInt16LE(samples[i], i * 2);
  }

  // Update file size and data size in header
  const fileSize = header.length + dataBuffer.length - 8;
  header.writeUInt32LE(fileSize, 4);
  header.writeUInt32LE(dataBuffer.length, 40);

  // Write the WAV file
  const filePath = path.join(soundsDir, 'click.wav');
  fs.writeFileSync(filePath, Buffer.concat([header, dataBuffer]));
  console.log('Created click sound file:', filePath);
  return filePath;
}

function playSound() {
  if (!mainWindow) return;
  mainWindow.webContents.send('play-sound');
}

function loadSoundConfig(soundProfile) {
  try {
    const soundDir = path.join(__dirname, '../assets/sounds', soundProfile);
    const configPath = path.join(soundDir, 'config.json');

    console.log('Checking sound configuration:', {
      soundProfile,
      soundDir,
      configPath,
      exists: fs.existsSync(configPath)
    });

    if (fs.existsSync(configPath)) {
      // Mechvibes-style sound pack
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const soundPath = path.join(soundDir, config.sound);

      console.log('Found Mechvibes config:', {
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
    } else {
      // Legacy single-sound format
      const mp3Path = path.join(soundDir + '.mp3');
      console.log('Checking legacy sound:', {
        mp3Path,
        exists: fs.existsSync(mp3Path)
      });

      if (fs.existsSync(mp3Path)) {
        return {
          type: 'legacy',
          soundPath: path.resolve(mp3Path) // Use absolute path
        };
      } else if (soundProfile === 'click') {
        const clickPath = createClickSound();
        return {
          type: 'click',
          soundPath: path.resolve(clickPath) // Use absolute path
        };
      }
    }

    throw new Error(`No valid sound configuration found for profile: ${soundProfile}`);
  } catch (error) {
    console.error('Error loading sound config:', error);
    throw error;
  }
}

function loadSound(soundProfile = store.get('selectedSound')) {
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
    dialog.showErrorBox('Error', `Failed to load sound: ${error.message}`);
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

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    loadSound(); // Load initial sound after window is ready
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    console.log('Loading tray icon from:', iconPath);

    if (!fs.existsSync(iconPath)) {
      console.error('Icon file not found:', iconPath);
      dialog.showErrorBox('Error', `Icon file not found: ${iconPath}`);
      return;
    }

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Enabled',
        type: 'checkbox',
        checked: isEnabled,
        click: () => {
          isEnabled = !isEnabled;
          store.set('isEnabled', isEnabled);
          console.log('Sound enabled:', isEnabled);

          // Play test sound when enabled
          if (isEnabled) {
            playSound();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Test Sound',
        click: () => {
          console.log('Test sound clicked');
          playSound();
        }
      },
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
  } catch (error) {
    console.error('Error creating tray:', error);
    dialog.showErrorBox('Error', `Failed to create tray: ${error.message}`);
  }
}

// Handle keyboard events
function handleKeyPress(event, isKeyUp = false) {
  if (!isEnabled) return;

  console.log(`Key ${isKeyUp ? 'released' : 'pressed'}:`, {
    event,
    isKeyUp,
    rawKeycode: event.keycode,
    currentSoundPath
  });

  // Convert raw key code to Mechvibes format (1-based index)
  const keyCode = String(event.keycode % 100 + 1);

  if (mainWindow) {
    const data = { keyCode, isKeyUp };
    console.log('Sending play-sound event:', data);
    mainWindow.webContents.send('play-sound', data);
  }
}

app.whenReady().then(() => {
  console.log('App is ready');

  createWindow();
  createTray();

  // Start keyboard hook with error handling
  try {
    uIOhook.start();
    uIOhook.on('keydown', (event) => handleKeyPress(event, false));
    uIOhook.on('keyup', (event) => handleKeyPress(event, true));
    console.log('Keyboard hook started successfully');
  } catch (error) {
    console.error('Error starting keyboard hook:', error);
    dialog.showErrorBox('Error', `Failed to start keyboard hook: ${error.message}`);
  }
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
ipcMain.on('toggle-enabled', (_event, value) => {
  isEnabled = value;
  store.set('isEnabled', value);
  console.log('Sound enabled:', value);

  // Play test sound when enabled
  if (isEnabled) {
    playSound();
  }
});

ipcMain.on('set-volume', (_event, value) => {
  store.set('volume', value);
  if (mainWindow) {
    mainWindow.webContents.send('set-volume', value);
  }
});

ipcMain.on('set-auto-start', async (_event, value) => {
  store.set('autoStart', value);
  if (!autoLauncher) {
    console.log('Auto-launch not available');
    return;
  }

  try {
    if (value) {
      await autoLauncher.enable();
    } else {
      await autoLauncher.disable();
    }
    console.log('Auto-start set to:', value);
  } catch (error) {
    console.log('Failed to set auto-start:', error);
  }
});

ipcMain.on('change-sound', (_event, soundProfile) => {
  console.log('Changing sound to:', soundProfile);
  store.set('selectedSound', soundProfile);
  loadSound(soundProfile);
}); 