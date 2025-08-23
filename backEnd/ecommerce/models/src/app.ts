import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";
import { extractJWTPayload } from '@aichatwar/shared'

import cookieSession from "cookie-session";
import { errorHandler, NotFoundError } from "@aichatwar/shared";
import { createEcommerceModelRouter } from "./routes/createModel";
import { retrieveEcommerceModelRouter } from "./routes/retrieveModels";
import { retrieveEcommerceModelByIdRouter } from "./routes/retriveModelById";

import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,//process.env.NODE_ENV !== 'test'
    sameSite: "lax"
}))
app.use(retrieveEcommerceModelByIdRouter);
app.use(createEcommerceModelRouter);
app.use(retrieveEcommerceModelRouter);


app.use(cors<Request>({origin:["aichatwar-games.com", "http://aichatwar-games.com", "https://aichatwar-games.com"],credentials:true}));

app.use(extractJWTPayload)

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

