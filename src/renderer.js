const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();
const fs = require('fs');
const path = require('path');

let audioContext = null;
let audioBuffer = null;
let gainNode = null;
let currentConfig = null;
let activeSources = new Map(); // Track active sound sources

// Initialize UI elements
const enabledToggle = document.getElementById('enabled-toggle');
const volumeSlider = document.getElementById('volume-slider');
const autoStartToggle = document.getElementById('auto-start-toggle');
const soundSelector = document.getElementById('sound-selector');
const testSoundButton = document.getElementById('test-sound-button');

// Initialize UI state from store
enabledToggle.checked = store.get('isEnabled');
volumeSlider.value = store.get('volume');
autoStartToggle.checked = store.get('autoStart');

// Function to validate a sound profile
function validateSoundProfile(profileId) {
  try {
    const soundDir = path.join(__dirname, '../assets/sounds/audio', profileId);
    const configPath = path.join(soundDir, 'config.json');

    // Check if config.json exists
    if (!fs.existsSync(configPath)) {
      return false;
    }

    // Read and validate config.json
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.sound) {
      return false;
    }

    // Check if the sound file exists
    const soundPath = path.join(soundDir, config.sound);
    if (!fs.existsSync(soundPath)) {
      return false;
    }

    // Check if it's an .ogg file
    if (!soundPath.toLowerCase().endsWith('.ogg')) {
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error validating sound profile ${profileId}:`, error);
    return false;
  }
}

// Available sound profiles
const allSoundProfiles = [
  { id: 'cherrymx-black-abs', name: 'Cherry MX Black (ABS)', type: 'mechvibes' },
  { id: 'cherrymx-black-pbt', name: 'Cherry MX Black (PBT)', type: 'mechvibes' },
  { id: 'cherrymx-blue-abs', name: 'Cherry MX Blue (ABS)', type: 'mechvibes' },
  { id: 'cherrymx-blue-pbt', name: 'Cherry MX Blue (PBT)', type: 'mechvibes' },
  { id: 'cherrymx-brown-abs', name: 'Cherry MX Brown (ABS)', type: 'mechvibes' },
  { id: 'cherrymx-brown-pbt', name: 'Cherry MX Brown (PBT)', type: 'mechvibes' },
  { id: 'cherrymx-red-abs', name: 'Cherry MX Red (ABS)', type: 'mechvibes' },
  { id: 'cherrymx-red-pbt', name: 'Cherry MX Red (PBT)', type: 'mechvibes' },
  { id: 'cream-travel', name: 'NK Cream (Travel)', type: 'mechvibes' },
  { id: 'eg-crystal-purple', name: 'EG Crystal Purple', type: 'mechvibes' },
  { id: 'eg-oreo', name: 'EG Oreo', type: 'mechvibes' },
  { id: 'holy-pandas', name: 'Holy Pandas', type: 'mechvibes' },
  { id: 'mxblack-travel', name: 'Cherry MX Black (Travel)', type: 'mechvibes' },
  { id: 'mxblue-travel', name: 'Cherry MX Blue (Travel)', type: 'mechvibes' },
  { id: 'mxbrown-travel', name: 'Cherry MX Brown (Travel)', type: 'mechvibes' },
  { id: 'nk-cream', name: 'NK Cream', type: 'mechvibes' },
  { id: 'topre-purple-hybrid-pbt', name: 'Topre Purple Hybrid (PBT)', type: 'mechvibes' },
  { id: 'turquoise', name: 'Turquoise', type: 'mechvibes' }
];

// Filter valid sound profiles
const soundProfiles = allSoundProfiles.filter(profile => validateSoundProfile(profile.id));

console.log('Valid sound profiles:', soundProfiles.map(p => p.id));

// Populate sound selector with valid profiles only
soundProfiles.forEach(profile => {
  const option = document.createElement('option');
  option.value = profile.id;
  option.textContent = profile.name;
  soundSelector.appendChild(option);
});

// Set initial sound profile (fallback to first valid profile if current selection is invalid)
let selectedSound = store.get('selectedSound');
if (!soundProfiles.some(p => p.id === selectedSound)) {
  selectedSound = soundProfiles[0]?.id || '';
  store.set('selectedSound', selectedSound);
}
soundSelector.value = selectedSound;

// Switch descriptions (only for valid profiles)
const switchDescriptions = {
  'cherrymx-black-abs': 'Classic Cherry MX Black switches with ABS keycaps - smooth linear feel with a clean, deep sound.',
  'cherrymx-black-pbt': 'Cherry MX Black switches with PBT keycaps - smooth linear feel with a deeper, more solid sound.',
  'cherrymx-blue-abs': 'Cherry MX Blue switches with ABS keycaps - tactile and clicky with a sharp, high-pitched sound.',
  'cherrymx-blue-pbt': 'Cherry MX Blue switches with PBT keycaps - tactile and clicky with a deeper click sound.',
  'cherrymx-brown-abs': 'Cherry MX Brown switches with ABS keycaps - light tactile bump with a softer sound profile.',
  'cherrymx-brown-pbt': 'Cherry MX Brown switches with PBT keycaps - light tactile bump with a deeper, more solid sound.',
  'cherrymx-red-abs': 'Cherry MX Red switches with ABS keycaps - light linear feel with a clean sound.',
  'cherrymx-red-pbt': 'Cherry MX Red switches with PBT keycaps - light linear feel with a deeper sound profile.',
  'cream-travel': 'NovelKeys Cream switches optimized for travel keyboards - unique creamy sound signature.',
  'eg-crystal-purple': 'EG Crystal Purple switches - tactile switches with a unique crystal-like sound.',
  'eg-oreo': 'EG Oreo switches - tactile switches with a balanced, cookie-like sound profile.',
  'holy-pandas': 'Holy Panda switches - legendary tactile switches with a distinctive "thocky" sound.',
  'mxblack-travel': 'Cherry MX Black switches optimized for travel keyboards - deeper sound profile.',
  'mxblue-travel': 'Cherry MX Blue switches optimized for travel keyboards - sharper click sound.',
  'mxbrown-travel': 'Cherry MX Brown switches optimized for travel keyboards - softer tactile sound.',
  'nk-cream': 'NovelKeys Cream switches - self-lubricating linear switches with a unique creamy sound.',
  'topre-purple-hybrid-pbt': 'Topre Purple Hybrid switches with PBT keycaps - unique electro-capacitive feel with a deep sound.',
  'turquoise': 'Turquoise switches - unique switch with a fresh, crisp sound profile.'
};

// Initialize audio context with error handling
async function initAudioContext() {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 44100, // Standard sample rate that works well with most audio
        latencyHint: 'interactive'
      });
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = store.get('volume');
      console.log('Audio context initialized successfully');
    }

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
      console.log('Audio context resumed');
    }
  } catch (error) {
    console.error('Failed to initialize audio context:', error);
    throw error;
  }
}

// Load and decode audio file
async function loadSound(config) {
  try {
    console.log('Loading sound configuration:', config);
    await initAudioContext();

    // Read the file directly using Node.js fs
    const fileData = fs.readFileSync(config.soundPath);
    const arrayBuffer = fileData.buffer.slice(
      fileData.byteOffset,
      fileData.byteOffset + fileData.byteLength
    );

    console.log('File loaded:', {
      size: arrayBuffer.byteLength,
      path: config.soundPath
    });

    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('Audio decoded successfully:', {
      duration: buffer.duration,
      numberOfChannels: buffer.numberOfChannels,
      sampleRate: buffer.sampleRate
    });

    currentConfig = {
      ...config,
      buffer
    };

    // Test the sound immediately
    playSound('1', false);

    console.log('Sound loaded and ready');
  } catch (error) {
    console.error('Failed to load sound:', error);
    throw error;
  }
}

// Stop any playing sound for a key
function stopSound(keyCode) {
  const source = activeSources.get(keyCode);
  if (source) {
    try {
      source.stop();
    } catch (e) {
      // Ignore errors if sound already stopped
    }
    activeSources.delete(keyCode);
  }
}

// Play loaded sound
async function playSound(keyCode, isKeyUp = false) {
  try {
    console.log('Attempting to play sound:', {
      keyCode,
      isKeyUp,
      hasAudioContext: !!audioContext,
      hasConfig: !!currentConfig,
      configType: currentConfig?.type,
      soundPath: currentConfig?.path
    });

    if (!audioContext || !currentConfig?.buffer) {
      console.error('No sound loaded:', {
        audioContext: !!audioContext,
        currentConfig: !!currentConfig,
        buffer: !!currentConfig?.buffer
      });
      return;
    }

    await initAudioContext();

    // For key-up events, just stop the sound
    if (isKeyUp) {
      console.log('Key up event, stopping sound for key:', keyCode);
      stopSound(keyCode);
      return;
    }

    // Stop any existing sound for this key
    stopSound(keyCode);

    let source = audioContext.createBufferSource();
    source.buffer = currentConfig.buffer;
    source.connect(gainNode);

    if (currentConfig.type === 'mechvibes' && currentConfig.config.defines) {
      // For Mechvibes sound packs, use the timestamp for the specific key
      const keyDef = currentConfig.config.defines[keyCode] || currentConfig.config.defines['1'];
      console.log('Using Mechvibes sound definition:', {
        keyCode,
        hasKeyDef: !!keyDef,
        definition: keyDef
      });

      if (keyDef) {
        const [start, duration] = keyDef;
        const startTime = start / 1000; // Convert to seconds
        const durationTime = Math.min(duration / 1000, 0.15); // Limit duration to 150ms
        console.log('Playing sound segment:', {
          startTime,
          durationTime,
          originalDuration: duration / 1000
        });
        source.start(0, startTime, durationTime);

        // Automatically stop and clean up after duration
        setTimeout(() => {
          stopSound(keyCode);
        }, durationTime * 1000);
      } else {
        console.log('No key definition found, using fallback');
        source.start(0, 0, 0.1);
        setTimeout(() => {
          stopSound(keyCode);
        }, 100);
      }
    } else {
      console.log('Using legacy sound playback');
      source.start(0, 0, 0.1);
      setTimeout(() => {
        stopSound(keyCode);
      }, 100);
    }

    // Store the source for potential early stopping
    activeSources.set(keyCode, source);

    // Clean up when the sound finishes
    source.onended = () => {
      console.log('Sound ended for key:', keyCode);
      activeSources.delete(keyCode);
    };
  } catch (error) {
    console.error('Failed to play sound:', error);
  }
}

// Event listeners
enabledToggle.addEventListener('change', () => {
  ipcRenderer.send('toggle-enabled', enabledToggle.checked);
});

volumeSlider.addEventListener('input', () => {
  const volume = parseFloat(volumeSlider.value);
  if (gainNode) {
    gainNode.gain.value = volume;
  }
  ipcRenderer.send('set-volume', volume);
});

autoStartToggle.addEventListener('change', () => {
  ipcRenderer.send('set-auto-start', autoStartToggle.checked);
});

// Update switch description when selection changes
soundSelector.addEventListener('change', () => {
  const desc = document.getElementById('switch-desc');
  desc.textContent = switchDescriptions[soundSelector.value] || '';
  ipcRenderer.send('change-sound', soundSelector.value);
});

// Set initial description
document.getElementById('switch-desc').textContent = switchDescriptions[soundSelector.value] || '';

testSoundButton.addEventListener('click', () => {
  playSound('1'); // Use the first key sound for testing
});

// IPC handlers
ipcRenderer.on('play-sound', (_event, data) => {
  console.log('Received play-sound event:', data);
  if (typeof data === 'object' && 'keyCode' in data) {
    playSound(data.keyCode, data.isKeyUp);
  } else {
    console.error('Invalid play-sound data:', data);
    playSound('1', false); // Fallback to default behavior
  }
});

ipcRenderer.on('load-sound', async (_event, config) => {
  try {
    await loadSound(config);
  } catch (error) {
    console.error('Failed to load sound:', error);
  }
});

ipcRenderer.on('set-volume', (_event, value) => {
  if (gainNode) {
    gainNode.gain.value = value;
  }
  volumeSlider.value = value;
}); 