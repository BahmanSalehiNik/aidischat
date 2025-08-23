
import express from "express";
import mongoose from "mongoose";

const startMongoose = async ()=>{
    if(!process.env.JWT_DEV){
        throw new Error("JWT_DEV must be defined!")
    }
        if(!process.env.MONGO_URI){
        throw new Error("MONGO_URI must be defined!")
    }
    try{
    await mongoose.connect(process.env.MONGO_URI);
    } catch(err) {
        console.error(err);
    }
    
}

startMongoose()

import { app } from "./app";

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