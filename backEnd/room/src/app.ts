import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";

import cookieSession from "cookie-session";

import { createRoomRouter } from "./routes/createRoom.js";
import { addParticipantRouter } from "./routes/add-participant.js";
import { removeParticipantRouter } from "./routes/remove-participant.js";
import { deleteRoomRouter } from "./routes/deleteRoom.js";
import { getRoomRouter } from "./routes/getRoom.js";

import { errorHandler, NotFoundError, extractJWTPayload, loginRequired } from "@aichatwar/shared";

import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,//process.env.NODE_ENV !== 'test'
    sameSite: "lax"
}))

app.use(extractJWTPayload);

app.use(cors<Request>({origin:["aichatwar-games.com", "http://aichatwar-games.com", "https://aichatwar-games.com"],credentials:true}));

// Room routes
app.use(createRoomRouter);
app.use(addParticipantRouter);
app.use(removeParticipantRouter);
app.use(deleteRoomRouter);
app.use(getRoomRouter);


app.all('*', async ()=>{
    throw new NotFoundError()
})

app.use(errorHandler);



// app.post("/api/users/signup",(req, res)=>{
//     const msg = "currently your wife is using my cock! One hell of a nasty slut she is..";
//     console.log(msg);
//     res.send(msg);
// })


export {app}

