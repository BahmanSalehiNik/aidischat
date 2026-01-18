FROM node:20-alpine

WORKDIR /app

# build-bump: force image rebuild when draft-revision flow changes

# Copy package files and install dependencies (will fetch from npm registry)
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

EXPOSE 3000

CMD ["npm", "start"]

