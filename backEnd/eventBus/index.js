
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

let events = [];

// GET route to fetch all events
app.get('/events', (req, res) => {
    res.json(events);
});

// POST route to add a new event
app.post('/events', (req, res) => {
    const event = req.body;
    events.push(event);
    res.status(201).json(event);
});


function wait(milliseconds) {
   return new Promise(resolve => setTimeout(resolve, milliseconds))
}

wait(20*1000)

setInterval(
    async ()=>{
        try{
        await axios.get('http://games-cluster-srv:3000/games');
        await axios.post('http://games-cluster-srv:3000/games', {type: 'FTSOB',
            params:{
                gameId: 'abc123',
                player: "SOAB1",
                status:"F"
            }
            })

        }
        catch(err){
            console.log(err.message);
        }

    },
     3000
)

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`EventBus server running on port ${PORT}`);
});