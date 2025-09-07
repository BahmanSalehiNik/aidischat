import express, {Request, Response} from "express";
import { Types } from "mongoose";
import { extractJWTPayload,loginRequired, NotAuthorizedError, NotFoundError, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";
import { Order } from "../models/order";


const router = express.Router();

router.get("/api/ecommerce/orders/:orderId",
    extractJWTPayload,
    loginRequired,
    validateRequest,
    async(req:Request, res:Response)=>{
    const userId = req.jwtPayload?.id;
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if(!order){
        throw new NotFoundError();
    }
    if(order.userId!=userId){
        throw new NotAuthorizedError(['not authorized'])
    }
    res.status(200).send(order);
})

export { router as getEcommerceOrderByIdRouter };