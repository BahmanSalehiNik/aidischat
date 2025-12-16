FROM node:20-alpine

WORKDIR /app

# Copy package files and install dependencies (will fetch from npm registry)
COPY backEnd/ai/aiGateway/package*.json ./
RUN npm install

# Copy application code
COPY backEnd/ai/aiGateway .

EXPOSE 3000

CMD ["npm", "start"]

