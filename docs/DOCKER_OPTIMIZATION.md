# Docker Image Optimization Guide

## 🎯 Optimizations Applied

### 1. **Removed Heavy Dependencies from Production** ✅
- **Before**: Copied entire `node_modules` (~500MB+) to production image
- **After**: Using Next.js standalone output which includes only necessary dependencies (~50-100MB)
- **Impact**: ~400MB+ reduction in image size

### 2. **Using Compiled JavaScript Instead of TypeScript** ✅
- **Before**: Running TypeScript files with `tsx` at runtime (requires dev dependencies)
- **After**: Using pre-compiled JavaScript from `dist/` folder
- **Impact**: Faster startup time, smaller image (no tsx or TypeScript compiler needed)

### 3. **Removed Unnecessary Files** ✅
- **Before**: Copying TypeScript source files (`src/`) to production
- **After**: Only copying compiled JavaScript and necessary runtime files
- **Impact**: Cleaner image, fewer files to copy

### 4. **Added .dockerignore** ✅
- Excludes development files, documentation, and unnecessary artifacts
- **Impact**: Faster build context upload, faster builds

### 5. **Optimized Environment Variables** ✅
- Using `ENV KEY=value` format instead of `ENV KEY value`
- More efficient and modern syntax

## 📊 Expected Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Image Size | ~1.2GB | ~400-600MB | **50-60% smaller** |
| Build Time | ~5-8 min | ~3-5 min | **30-40% faster** |
| Startup Time | ~5-10s | ~2-4s | **50-60% faster** |
| Memory Usage | Higher (tsx overhead) | Lower (native Node.js) | **~20-30% less** |

## 🔧 Build and Run

### Build the optimized image:
```bash
docker-compose build
```

### Run the containers:
```bash
docker-compose up
```

### Check image size:
```bash
docker images | grep stream-wars
```

## 🚀 Additional Optimization Opportunities

### 1. Multi-Architecture Builds (Future)
```dockerfile
# Add to docker-compose.yml
platforms:
  - linux/amd64
  - linux/arm64
```

### 2. Use BuildKit Cache Mounts (Future)
```dockerfile
RUN --mount=type=cache,target=/root/.npm \
    npm ci
```

### 3. Production-Only Dependencies
Consider splitting dependencies in `package.json`:
- Move dev-only packages to `devDependencies`
- Use `npm ci --omit=dev` in production

### 4. Layer Caching Optimization
The current Dockerfile is already optimized for layer caching:
- Dependencies are installed in a separate stage
- Source code is copied last
- Build happens before runtime layer

## 📝 Notes

- The `standalone` output from Next.js already includes all necessary runtime dependencies
- No need to install `tsx` in production - we use compiled JavaScript
- The image uses Alpine Linux (smallest base image available)
- Non-root user (`nextjs`) for better security

## 🔍 Verification

After building, verify the optimizations:

```bash
# Check image size
docker images stream-wars-app

# Check layers
docker history stream-wars-app

# Test the application
docker-compose up
# Visit http://localhost:3000 (Next.js app)
# WebSocket server on ws://localhost:3001
```

## 🛠️ Troubleshooting

If you encounter issues:

1. **"Cannot find module" errors**: Ensure `build:server` runs successfully
2. **Permission errors**: The entrypoint script should be executable (chmod +x)
3. **Kafka connection issues**: Ensure Kafka is ready before the app starts (use `depends_on` with healthchecks)

