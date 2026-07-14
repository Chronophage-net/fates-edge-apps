#!/bin/bash
# Build script for Fate's Edge static site

set -e

echo "🔨 Building Fate's Edge Static Site..."

# Generate deterministic seed
echo "🎲 Generating deterministic seed..."
node js/tools/generate-seed.js --output=.seed/random-seed.json

# Copy seed to output directory if we're building to a dist folder
# This assumes the build output is in a 'dist' directory
if [ -d "dist" ]; then
    mkdir -p dist/.seed
    cp .seed/random-seed.json dist/.seed/
    cp .seed/seed.js dist/
    echo "✅ Seed copied to dist/"
fi

# Copy other assets
echo "📁 Copying assets..."
cp -r css/ dist/ 2>/dev/null || true
cp -r data/ dist/ 2>/dev/null || true
cp -r factions/ dist/ 2>/dev/null || true
cp -r regions/ dist/ 2>/dev/null || true
cp -r js/ dist/ 2>/dev/null || true
cp index.html dist/ 2>/dev/null || true
cp wiki.json dist/ 2>/dev/null || true

# Copy seed to data directory as well (for fallback)
if [ -d "dist" ]; then
    cp .seed/random-seed.json dist/data/ 2>/dev/null || true
    echo "✅ Seed copied to dist/data/ for fallback"
fi

echo "✅ Build complete!"
