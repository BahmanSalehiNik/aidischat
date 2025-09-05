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

        const updatedModel = await EcommerceModel.findByIdAndUpdate(req.body.id, {$set:{price: req.body.price}}, {new: true})
        // await updatedModel?.save()
        if(updatedModel)
    new EcommerceUpdatePublisher(natsClient.client).publish({
        id: updatedModel.id,
        price: updatedModel.price,
        modelId: updatedModel.modelId,
        userId: updatedModel.userId,
        rank: updatedModel.rank
    })

        return res.status(200).send(updatedModel)
        })

export { router as updateEcommerceModelRouter };