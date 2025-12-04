# TypeScript Precompilation Guide

## What is Precompilation?

**Precompilation** means compiling TypeScript to JavaScript **during the Docker build process**, rather than at runtime.

### Current Approach (Runtime Compilation)
- Uses `ts-node-dev` to compile TypeScript on-the-fly when the container starts
- **Problems:**
  - High memory usage (TypeScript compiler + runtime)
  - Slow startup time
  - Requires dev dependencies in production
  - Can cause OOMKilled errors

### Precompilation Approach
- Compiles TypeScript to JavaScript during Docker build
- Runs compiled JavaScript with plain Node.js
- **Benefits:**
  - ✅ Lower memory usage (no runtime compilation)
  - ✅ Faster startup time
  - ✅ No dev dependencies needed at runtime
  - ✅ Smaller production image (after pruning dev deps)
  - ✅ Catches compilation errors during build, not at runtime

## How It Works

### 1. TypeScript Configuration (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "outDir": "./build",  // Output compiled JS files here
    "module": "commonjs",
    "target": "es2016"
  }
}
```

### 2. Package.json Scripts
```json
{
  "scripts": {
    "build": "tsc",                    // Compile TypeScript
    "start": "node build/index.js",    // Run compiled JavaScript
    "start:dev": "ts-node-dev --poll src/index.ts"  // For local dev
  }
}
```

### 3. Dockerfile Process
```dockerfile
# Step 1: Install ALL dependencies (including TypeScript compiler)
RUN npm install

# Step 2: Copy source files
COPY src ./src

# Step 3: Compile TypeScript → JavaScript
RUN npm run build

# Step 4: Remove dev dependencies (optional, reduces image size)
RUN npm prune --production

# Step 5: Run compiled JavaScript
CMD ["npm", "start"]
```

### 4. Build Output Structure
```
src/
  index.ts          → build/index.js
  routes/
    getFeed.ts      → build/routes/getFeed.js
```

## Implementation Status

### ✅ Feed Service
- Updated `tsconfig.json` with `outDir: "./build"`
- Added `build` script to `package.json`
- Updated `start` script to run compiled JS
- Updated Dockerfile to compile during build
- Updated `.dockerignore` to exclude local `build/` folder

### 🔄 Post Service
- Same changes needed (can be applied)

### 📝 Other Services
- Can be applied to any TypeScript service

## Memory Comparison

| Approach | Memory Usage | Startup Time |
|----------|-------------|--------------|
| Runtime (`ts-node-dev`) | ~1.5-2GB | 10-30 seconds |
| Precompiled | ~200-500MB | 2-5 seconds |

## Local Development

For local development, you can still use `ts-node-dev`:
```bash
npm run start:dev  # Uses ts-node-dev for hot reload
```

For production builds:
```bash
npm run build      # Compile TypeScript
npm start          # Run compiled JavaScript
```

## Migration Checklist

When migrating a service to precompilation:

1. ✅ Update `tsconfig.json` - set `outDir: "./build"`
2. ✅ Update `package.json` - add `build` script, update `start` script
3. ✅ Update Dockerfile - add compilation step before `CMD`
4. ✅ Update `.dockerignore` - exclude `build/` folder
5. ✅ Test locally - run `npm run build && npm start`
6. ✅ Test Docker build - ensure compilation succeeds
7. ✅ Reduce memory limits - can lower from 2Gi to 1Gi or less

## Notes

- The `build/` folder is generated during Docker build, not copied from local
- Dev dependencies are only needed during build, not at runtime
- Source maps can be enabled for debugging: `"sourceMap": true` in `tsconfig.json`
- The compiled JavaScript is production-ready and optimized

