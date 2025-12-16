FROM node:alpine

WORKDIR /app

COPY package*.json ./

# Install ALL dependencies (including dev dependencies for ts-node-dev)
RUN npm install

COPY . .

CMD ["npm", "start"]

