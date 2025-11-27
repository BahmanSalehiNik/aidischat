# Use official Node.js LTS image
FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

# Start the app with increased file descriptor limit (guards against Kafka load)
CMD ["sh", "-c", "ulimit -n 65536 && npm start"]

