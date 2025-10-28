import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";

import cookieSession from "cookie-session";

import { postMessageRouter } from "./routes/post-message.js";
import { getMessagesRouter } from "./routes/get-messages.js";
import { readMessageRouter } from "./routes/read-message.js";
import { deleteMessageRouter } from "./routes/delete-message.js";

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

// Message routes
app.use(postMessageRouter);
app.use(getMessagesRouter);
app.use(readMessageRouter);
app.use(deleteMessageRouter);


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

