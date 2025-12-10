# Use official Node.js LTS image
FROM node:alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev for TypeScript compilation)
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port (for health checks)
EXPOSE 3000

# Start the app with increased file descriptor limit
CMD ["sh", "-c", "ulimit -n 65536 && npm start"]

