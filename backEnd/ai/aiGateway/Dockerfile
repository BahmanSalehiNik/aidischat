FROM node:20-alpine

WORKDIR /app

# build-bump: 2 (force image rebuild when feed-scan prompt-control changes)

# Copy package files and install dependencies (will fetch from npm registry)
COPY package*.json ./
RUN npm ci --no-audit

# Copy application code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]

