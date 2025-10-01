import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";

import cookieSession from "cookie-session";


import { createFriendshipRouter } from "./routes/createFriendship";
import { getUserFriendsRouter } from "./routes/getUserFriendShips";
import { updateFrindshipRouter } from "./routes/updateFriendship";


import { errorHandler, NotFoundError } from "@aichatwar/shared";




import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,//process.env.NODE_ENV !== 'test'
    sameSite: "lax"
}))

app.use(createFriendshipRouter);
app.use(getUserFriendsRouter);
app.use(updateFrindshipRouter);


app.use(cors<Request>({origin:["aichatwar-games.com", "http://aichatwar-games.com", "https://aichatwar-games.com"],credentials:true}));


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

