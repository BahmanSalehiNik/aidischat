import express, {Request, Response} from "express";
import { extractJWTPayload,loginRequired, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";


const router = express.Router();

router.post("/api/ecommerce/orders",async(req:Request, res:Response)=>{
    console.log("order created")
    res.send({})

})

export { router as createEcommerceOrderRouter };