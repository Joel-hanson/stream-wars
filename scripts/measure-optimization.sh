#!/bin/bash

# Script to measure Docker image optimization improvements
# Usage: ./measure-optimization.sh

echo "🔍 Docker Image Optimization Measurement"
echo "========================================"
echo ""

# Build the optimized image
echo "📦 Building optimized Docker image..."
DOCKER_BUILDKIT=1 docker-compose build app

echo ""
echo "📊 Image Size Analysis:"
echo "----------------------"

# Get image details
IMAGE_NAME=$(docker-compose config | grep "image:" | head -1 | awk '{print $2}')
if [ -z "$IMAGE_NAME" ]; then
    IMAGE_NAME="stream-wars-app"
fi

docker images | grep -E "REPOSITORY|$IMAGE_NAME" | head -2

echo ""
echo "🔍 Layer Analysis:"
echo "------------------"
docker history "$IMAGE_NAME" --human --format "table {{.Size}}\t{{.CreatedBy}}" | head -15

echo ""
echo "💾 Image Details:"
echo "-----------------"
docker inspect "$IMAGE_NAME" --format='Image ID: {{.Id}}'
docker inspect "$IMAGE_NAME" --format='Created: {{.Created}}'
docker inspect "$IMAGE_NAME" --format='Size: {{.Size}} bytes'

# Convert bytes to MB
SIZE_BYTES=$(docker inspect "$IMAGE_NAME" --format='{{.Size}}')
SIZE_MB=$((SIZE_BYTES / 1024 / 1024))
echo "Size: ${SIZE_MB} MB"

echo ""
echo "🎯 Optimization Summary:"
echo "-----------------------"
echo "✅ Using Next.js standalone output (minimal dependencies)"
echo "✅ Running compiled JavaScript (no tsx overhead)"
echo "✅ Removed TypeScript source files from production"
echo "✅ Added .dockerignore for faster builds"
echo "✅ Using Alpine Linux base (smallest image)"
echo "✅ Non-root user for security"
echo "✅ Health checks configured"

echo ""
echo "🚀 To run the optimized container:"
echo "docker-compose up"
echo ""
echo "🔗 Access your application:"
echo "   Next.js app: http://localhost:3000"
echo "   WebSocket:   ws://localhost:3001"

