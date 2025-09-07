import express, {Request, Response} from "express";
import { extractJWTPayload,loginRequired, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";
import { Order } from "../models/order";


const router = express.Router();

router.get("/api/ecommerce/orders",
    extractJWTPayload,
    loginRequired,
    async(req:Request, res:Response)=>{
    const userId = req.jwtPayload!.id;
    const orders = await Order.find({
        userId:userId
    }).populate('aiModelCard');
    res.status(200).send({orders})
})

export { router as getEcommerceOrderRouter };