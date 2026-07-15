#!/bin/bash
# Build script for Fate's Edge static site

set -e

echo "🔨 Building Fate's Edge Static Site..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Generate deterministic seed
echo "🎲 Generating deterministic seed..."
node js/tools/generate-seed.js --output=.seed/random-seed.json

# Build with Vite
echo "🏗️ Building with Vite..."
npx vite build

# Copy seed files to dist after Vite build
echo "📦 Copying seed files to dist..."
mkdir -p dist/.seed
cp .seed/random-seed.json dist/.seed/
cp .seed/seed.js dist/

# Copy seed to data directory as well
mkdir -p dist/data
cp .seed/random-seed.json dist/data/seed.json
cp .seed/seed.js dist/data/seed.js

echo "✅ Build complete!"
