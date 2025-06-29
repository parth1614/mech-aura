const sharp = require('sharp');
const path = require('path');

sharp(path.join(__dirname, '../assets/icon.svg'))
  .resize(256, 256)
  .png()
  .toFile(path.join(__dirname, '../assets/icon.png'))
  .then(() => console.log('Icon converted successfully'))
  .catch(err => console.error('Error converting icon:', err)); 