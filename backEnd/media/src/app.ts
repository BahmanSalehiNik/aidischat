import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";

import cookieSession from "cookie-session";


import { createMediaRouter } from "./routes/create";
import { showMediaRouter } from "./routes/show";
import { deleteMediaRouter } from "./routes/delete";
import { listMediaRouter } from "./routes/list";
import { listMediaByOwnerRouter } from "./routes/listByOwner";
import { uploadRouter } from "./routes/upload";


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

app.use(createMediaRouter);
app.use(showMediaRouter);
app.use(deleteMediaRouter);
app.use(listMediaRouter);
app.use(listMediaByOwnerRouter);
app.use(uploadRouter);


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

