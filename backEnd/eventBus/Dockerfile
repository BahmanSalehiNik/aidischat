FROM node:18

WORKDIR /app/backEnd/eventBus

COPY package*.json ./

RUN npm install

COPY . .

RUN npm install -g nodemon

EXPOSE 3001

CMD ["nodemon", "index.js"]

