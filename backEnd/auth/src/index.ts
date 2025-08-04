import express from "express";
require("express-async-errors");
import { json } from "body-parser";
import mongoose from "mongoose";

import { currentUserRouter } from "./routes/currentuser";
import { signinRouter } from "./routes/signin";
import { signUpRouter } from "./routes/signup";
import { signOutRouter } from "./routes/signout";
import { errorHandler } from "./middlewares/error-handler";
import { NotFoundError } from "./errors/notfoundError";


const app = express();

app.use(json());
app.use(currentUserRouter);
app.use(signUpRouter);
app.use(signinRouter);
app.use(signOutRouter);

app.all('*', async ()=>{
    throw new NotFoundError()
})

app.use(errorHandler);



// app.post("/api/users/signup",(req, res)=>{
//     const msg = "currently your wife is using my cock! One hell of a nasty slut she is..";
//     console.log(msg);
//     res.send(msg);
// })

const startMongoose = async ()=>{
    try{
    await mongoose.connect('mongodb://auth-mongo-srv:27017/auth');
    } catch(err) {
        console.error(err);
    }
    
}

startMongoose()

app.listen(3000, ()=>{
    console.log("app listening on port 3000!, it is.. or is it soab")
})

app.use(function (req: express.Request, res: express.Response, next) {
    next({ status: 404 });
});

app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error(err);
    res.status(err.status || 500).json();
});