import express, {Request, Response} from "express";
import { extractJWTPayload,loginRequired, NotAuthorizedError, NotFoundError, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { EcommerceModel } from "../models/ecommerceModel";
import { EcommerceUpdatePublisher } from "../events/publishers/ecommercePublishers";
import { natsClient } from "../nats-client";


const router = express.Router();

router.put("/api/ecommerce/models",
    extractJWTPayload,
    loginRequired,
    [
    body('ecommerceModelId')
    .trim()
    .not()
    .isEmpty()
    .withMessage('model id cannot be empty!'),
    body('id')
    .trim()
    .not()
    .isEmpty()
    .withMessage('id cannot be empty!'),
    body('price')
    .trim()
    .not()
    .isEmpty()
    .isFloat({gt: 0})
    .withMessage('invalid price'),
    ]
    ,validateRequest, 
    async (req:Request, res:Response)=>{
        
        const newEcommerceModel = await EcommerceModel.findById(req.body.id)
        if(!newEcommerceModel){
            throw new NotFoundError();
        }
        if(JSON.parse(newEcommerceModel.userId).id !== req.jwtPayload?.id){
            throw new NotAuthorizedError(['not authorized!'])
        }

        const model = await EcommerceModel.findById(req.body.id)//, {$set:{price: req.body.price}}, {new: true})
        model!.set("price", req.body.price);
        await model!.save()
        if(model){
    new EcommerceUpdatePublisher(natsClient.client).publish({
        id: model.id,
        price: model.price,
        modelId: model.modelId,
        userId: model.userId,
        rank: model.rank,
        version: model.version
    })
        }
        return res.status(200).send(model)
        })

export { router as updateEcommerceModelRouter };