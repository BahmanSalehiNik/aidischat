const express = require('express');
const bodyParser = require('body-parser');


const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());


// In-memory store for the game document
let gameDocument = {};

// GET endpoint to retrieve the game document
app.get('/game', (req, res) => {
    res.json(gameDocument);
});

// POST endpoint to update the game document
app.post('/game', (req, res) => {
    gameDocument = req.body;
    res.status(200).json({ message: 'Game document updated', game: gameDocument });
});

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";
app.listen(PORT, HOST, () => {
    console.log(`Game service listening on port ${PORT}`);
});