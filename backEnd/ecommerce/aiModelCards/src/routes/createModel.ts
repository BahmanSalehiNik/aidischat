import express, {Request, Response} from "express";
import { extractJWTPayload,loginRequired, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { EcommerceModel } from "../models/ecommerceModel";
import { EcommerceCreatePublisher } from "../events/publishers/ecommercePublishers";
import { natsClient } from "../nats-client";


const router = express.Router();

router.post("/api/ecommerce/models",
    extractJWTPayload,
    loginRequired,
    [
    body('ecommerceModelId')
    .trim()
    .not()
    .isEmpty()
    .withMessage('model id cannot be empty!'),
    body('price')
    .trim()
    .not()
    .isEmpty()
    .isFloat({gt: 0})
    .withMessage('invalid price'),
    ]
    ,validateRequest, 
    async (req:Request, res:Response)=>{
        
        const newEcommerceModel = EcommerceModel.add({
            //TODO: refactor to include only userId instead of the complete jwtPayload: userId: {id:234, email..} rafactored to userId:234
            userId: JSON.stringify(req.jwtPayload),
            rank: req.body.rank | -1, //-1 means not ranked yet. TODO: the rank must not be provided by the user but calculated by the app
            modelId: req.body.ecommerceModelId,
            price: req.body.price
        })
    await newEcommerceModel.save();
    await new EcommerceCreatePublisher(natsClient.client).publish({
        id: newEcommerceModel.id,
        price: newEcommerceModel.price,
        modelId: newEcommerceModel.modelId,
        userId: newEcommerceModel.userId,
        rank: newEcommerceModel.rank,
        version: newEcommerceModel.version
    })

    res.status(201).send({data:newEcommerceModel});
})

export { router as createEcommerceModelRouter };