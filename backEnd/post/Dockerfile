# Use official Node.js LTS image
FROM node:alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including dev dependencies for TypeScript compiler)
RUN npm config set audit false && \
    npm install --no-audit && \
    npm config set audit true

# Copy source files
COPY src ./src

# Compile TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size (optional but recommended)
RUN npm prune --production

# Expose port (change if your app uses a different port)
# EXPOSE 3000

# Start the app with Node.js (running compiled JavaScript)
CMD ["npm", "start"]