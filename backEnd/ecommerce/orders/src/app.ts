import express, { Request } from "express";
require("express-async-errors");
import { json } from "body-parser";
import { extractJWTPayload } from '@aichatwar/shared'

import cookieSession from "cookie-session";
import { errorHandler, NotFoundError } from "@aichatwar/shared";
import { createEcommerceOrderRouter } from "./routes/createOrder";
import { getEcommerceOrderRouter } from "./routes/retrieveOrders";
import { getEcommerceOrderByIdRouter } from "./routes/retriveOrderById";
import { cancelEcommerceOrderRouter } from "./routes/cancelOrder";
import cors from "cors";

const app = express();
app.set('trust proxy', true);
app.use(json());
app.use(cookieSession({
    signed: false,
    secure: false,//process.env.NODE_ENV !== 'test'
    sameSite: "lax"
}) as any);
app.use(getEcommerceOrderByIdRouter);
app.use(createEcommerceOrderRouter);
app.use(getEcommerceOrderRouter);
app.use(cancelEcommerceOrderRouter);

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

