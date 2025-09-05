import express, {Request, Response} from "express";
import { extractJWTPayload,loginRequired, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";


const router = express.Router();

router.delete("/api/ecommerce/orders/:orderId",async(req:Request, res:Response)=>{
    console.log("delete order!")
    res.send({})
})

export { router as deleteEcommerceOrderRouter };