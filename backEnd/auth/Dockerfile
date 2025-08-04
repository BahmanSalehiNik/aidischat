# Use official Node.js LTS image
FROM node:alpine

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all files and subdirectories to the working directory
COPY . .


# Expose port (change if your app uses a different port)
# EXPOSE 3000

# Start the app with nodemon
CMD ["npm", "start"]