
import express from "express";
import mongoose from "mongoose";
import { app } from "./app";
import { natsClient } from "./nats-client";



const startMongoose = async ()=>{
    if(!process.env.JWT_DEV){
        throw new Error("JWT_DEV must be defined!")
    }
        if(!process.env.MONGO_URI){
        throw new Error("MONGO_URI must be defined!")
    }
        if(!process.env.NATS_URL){
        throw new Error("NATS_URL must be defined!")
    }
        if(!process.env.NATS_CLUSTER_ID){
        throw new Error("NATS_CLUSTER_ID must be defined!")
    }
        if(!process.env.NATS_CLIENT_ID){
        throw new Error("NATS_CLIENT_ID must be defined!")
    }
    try{
      // ------------ Nats ------------
      await natsClient.connect(process.env.NATS_CLUSTER_ID,process.env.NATS_CLIENT_ID,process.env.NATS_URL);
        natsClient.client.on('close',()=>{
        console.log('NATS connection closed!')
        process.exit()
    })
    
    process.on('SIGINT', ()=>natsClient.client.close());
    process.on('SIGTERM', ()=> natsClient.client.close());
      
      // ------------ Mongoose ----------
      await mongoose.connect(process.env.MONGO_URI);
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