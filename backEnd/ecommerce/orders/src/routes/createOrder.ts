import express, {Request, Response} from "express";
import { BadRequestError, extractJWTPayload,loginRequired, NotFoundError, OrderStatus, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";
import { AiModelCard } from "../models/aiModelCard";
import { Order } from "../models/order";
import { Types } from "mongoose";
import { EcommerceModelCreatedEvent } from "@aichatwar/shared";
import { EcommerceOrderCreatedPublisher } from "../events/publishers/ordersPublishers";

const router = express.Router();

const EXPIRATION_SECONDS = 10 * 60; 

router.post("/api/ecommerce/orders",    
    extractJWTPayload,
    loginRequired,
    [
        body('aiModelCardId')
        // TODO: Causes coupling with the ecommerce model service, can be removed!
        .custom((input: string)=> Types.ObjectId.isValid(input))
        .notEmpty()
        .withMessage('Card Id can not be empty')
    ], 
    validateRequest,
    async(req:Request, res:Response)=>{
        // Find the ai model card in db
        const cardRefId = req.body.aiModelCardId;
        console.log(cardRefId);
        const aiModelCard = await AiModelCard.findOne({cardRefId:cardRefId});
        if(!aiModelCard){
            throw new NotFoundError();
        }
        // check if the card is not reserved or cancelled
   
        const isAvailable = await aiModelCard.isAvailable();
        if(!isAvailable){
            throw new BadRequestError('ai model card not available');
        }

        const expiration = new Date();
        expiration.setSeconds(expiration.getSeconds()+ EXPIRATION_SECONDS)

        const order = Order.add({
            userId: req.jwtPayload!.id,
            status: OrderStatus.Created,
            expirationDate: expiration,
            aiModelCard: aiModelCard
        })
        
        await order.save();



        new EcommerceOrderCreatedPublisher(natsClient.client).publish({
            id: order.id,
            status: order.status,
            expirationDate: order.expirationDate.toISOString(),
            userId: order.userId,
            version: order.version,
            aiModelCard:{
                id: aiModelCard.id,
                price: aiModelCard.price,
                cardRefId: aiModelCard.cardRefId,
                modelRefId: aiModelCard.cardRefId,
                userId: aiModelCard.userId,
                version: aiModelCard.version
            }
        })
    
        console.log("order created", order);
        res.status(201).send(order)

})

export { router as createEcommerceOrderRouter };