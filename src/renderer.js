const { ipcRenderer } = require('electron');
const Store = require('electron-store');
const store = new Store();
const fs = require('fs');

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

// Available sound profiles
const soundProfiles = [
  { id: 'cherry-mx-black-abs', name: 'Cherry MX Black (ABS)', type: 'mechvibes' },
  { id: 'akko-silver', name: 'Akko CS Silver', type: 'legacy' },
  { id: 'gateron-black', name: 'Gateron Black Ink', type: 'legacy' },
  { id: 'nk-cream', name: 'NovelKeys Cream', type: 'legacy' },
  { id: 'boba-u4t', name: 'Gazzew Boba U4T', type: 'legacy' },
  { id: 'alpaca', name: 'Alpaca Linear', type: 'legacy' },
  { id: 'tangerine', name: 'C³ Tangerine', type: 'legacy' },
  { id: 'holy-panda', name: 'Drop Holy Panda', type: 'legacy' },
  { id: 'click', name: 'Simple Click', type: 'legacy' }
];

// Populate sound selector
soundProfiles.forEach(profile => {
  const option = document.createElement('option');
  option.value = profile.id;
  option.textContent = profile.name;
  soundSelector.appendChild(option);
});

// Set initial sound profile
soundSelector.value = store.get('selectedSound');

// Switch descriptions
const switchDescriptions = {
  'cherry-mx-black-abs': 'Classic Cherry MX Black switches with ABS keycaps - smooth linear feel with a clean, deep sound.',
  'akko-silver': 'Budget-friendly linear switch with a light, crisp sound. Great for gaming.',
  'gateron-black': 'Premium linear switch known for its deep, satisfying sound and buttery-smooth feel.',
  'alpaca': 'Smooth linear switch with a clean, satisfying sound profile. Popular in custom keyboards.',
  'tangerine': 'Premium linear switch with a distinctive high-pitched "clacky" sound. Very smooth operation.',
  'nk-cream': 'Self-lubricating linear switch with a unique "creamy" sound signature.',
  'boba-u4t': 'Popular tactile switch known for its "thocky" sound and strong tactile feedback.',
  'holy-panda': 'Legendary tactile switch with a distinctive sound and sharp tactile bump.',
  'click': 'Basic click sound for a classic mechanical keyboard feel.'
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