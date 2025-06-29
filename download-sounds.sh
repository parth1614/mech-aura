#!/bin/bash

# Create sounds directory if it doesn't exist
mkdir -p assets/sounds

# Download sound files from Mechvibes repository
echo "Downloading mechanical keyboard sounds..."

# Akko
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/akko-cs-silver/press.mp3" -o assets/sounds/akko-silver.mp3

# Gateron Black Ink
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/gateron-black-ink/press.mp3" -o assets/sounds/gateron-black.mp3

# NK Cream
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/nk-cream/press.mp3" -o assets/sounds/nk-cream.mp3

# Boba U4T
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/boba-u4t/press.mp3" -o assets/sounds/boba-u4t.mp3

# Alpaca Linear
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/alpaca/press.mp3" -o assets/sounds/alpaca.mp3

# Tangerine
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/c3-tangerine/press.mp3" -o assets/sounds/tangerine.mp3

# Holy Panda
curl -L "https://github.com/hainguyents13/mechvibes/raw/main/src/audio/holy-panda/press.mp3" -o assets/sounds/holy-panda.mp3

# Make the script executable
chmod +x download-sounds.sh

echo "Done downloading sounds!" 