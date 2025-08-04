const axios = require('axios');
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


function wait(milliseconds) {
   return new Promise(resolve => setTimeout(resolve, milliseconds))
}

wait(20*1000)

// Start the server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "localhost";

setInterval(
    async ()=>{

        try{

        const events = await axios.get('http://evbus-srv:3001/events');
        console.log(events)
        const creation = await axios.post('http://evbus-srv:3001/events', {type: 'GameCreated',
            params:{
                gameId: 'abc123',
                player: "SOAB1",
                status:"NF"
            }
        })

        console.log(creation);

        }
        catch(err){
            console.log(err.message);
        }

    },
     3000
)

app.listen(PORT, HOST, () => {
    console.log("Game service k8s..");
    console.log("Game service k9s..");
    console.log("Game service k10s..");
    console.log(`Game service listening on port ${PORT}`);
});