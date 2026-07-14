#!/bin/bash
# Build script for Fate's Edge Client Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Building Fate's Edge Client Docker Image${NC}"

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Build the Docker image
echo -e "${YELLOW}📦 Building Docker image...${NC}"
docker build \
    --tag fates-edge-client:latest \
    --tag fates-edge-client:$(git rev-parse --short HEAD 2>/dev/null || echo "latest") \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    --build-arg VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown") \
    --build-arg VERSION=$(cat package.json | jq -r .version 2>/dev/null || echo "1.0.0") \
    -f Dockerfile \
    .

echo -e "${GREEN}✅ Docker image built successfully!${NC}"

# Show image info
echo -e "\n${YELLOW}📊 Image Information:${NC}"
docker images | grep fates-edge-client

# Optional: Run the container for testing
if [ "$1" == "--run" ]; then
    echo -e "\n${YELLOW}🧪 Running test container...${NC}"
    docker run --rm -p 8080:80 --name fates-edge-test fates-edge-client:latest &
    sleep 3
    echo -e "${GREEN}✅ Container running at http://localhost:8080${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the container${NC}"
    wait
fi
