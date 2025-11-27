# Use official Node.js LTS image
FROM node:alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

CMD ["sh", "-c", "ulimit -n 65536 && npm start"]

