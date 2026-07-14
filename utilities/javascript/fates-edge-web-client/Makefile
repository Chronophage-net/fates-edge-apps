# Makefile for Fate's Edge Client

.PHONY: build run stop clean test push

# Variables
IMAGE_NAME = fates-edge-client
VERSION ?= latest
PORT ?= 8080
DOCKER_REGISTRY ?=

# Build the Docker image
build:
	@echo "📦 Building Docker image..."
	docker build -t $(IMAGE_NAME):$(VERSION) .

# Run the container
run: build
	@echo "🚀 Running container..."
	docker run -d --name $(IMAGE_NAME) -p $(PORT):80 $(IMAGE_NAME):$(VERSION)

# Stop the container
stop:
	@echo "🛑 Stopping container..."
	docker stop $(IMAGE_NAME) || true
	docker rm $(IMAGE_NAME) || true

# Clean up
clean: stop
	@echo "🧹 Cleaning up..."
	docker image prune -f

# Test the container
test: run
	@echo "🧪 Testing container..."
	sleep 3
	curl -f http://localhost:$(PORT)/health || (docker logs $(IMAGE_NAME) && exit 1)
	curl -f http://localhost:$(PORT)/api || (docker logs $(IMAGE_NAME) && exit 1)
	@echo "✅ All tests passed!"

# Push to registry
push: build
	@echo "📤 Pushing to registry..."
ifdef DOCKER_REGISTRY
	docker tag $(IMAGE_NAME):$(VERSION) $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
	docker push $(DOCKER_REGISTRY)/$(IMAGE_NAME):$(VERSION)
else
	@echo "No registry specified. Set DOCKER_REGISTRY variable."
endif

# Full workflow
all: clean build test
	@echo "✅ Build complete!"

# Development workflow
dev:
	@echo "🔧 Starting development server..."
	docker-compose up --build

# Production deployment
deploy: build push
	@echo "🚀 Deployed to registry!"
