# Use official Node.js LTS image
FROM node:alpine

# Set working directory inside the container
WORKDIR /app

# build-bump: 2 (force image rebuild when feed-scan routing/prompt-control changes)

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Disable npm audit globally and install dependencies
RUN npm config set audit false && \
    npm install --omit=dev --no-audit && \
    npm config set audit true

# Copy all files and subdirectories to the working directory
COPY . .

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "start"]

