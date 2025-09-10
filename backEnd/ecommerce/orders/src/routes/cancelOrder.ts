import express, {Request, Response} from "express";
import { BadRequestError, extractJWTPayload,loginRequired, NotAuthorizedError, NotFoundError, OrderStatus, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";
import { Types } from "mongoose";
import { Order } from "../models/order";
import { EcommerceOrderCancelledPublisher } from "../events/publishers/ordersPublishers";

const router = express.Router();

router.patch("/api/ecommerce/orders",
    extractJWTPayload,
    loginRequired,
    [
                body('orderId')
                // TODO: Causes coupling with the ecommerce model service, can be removed!
                .custom((input: string)=> Types.ObjectId.isValid(input))
                .notEmpty()
                .withMessage('order Id can not be empty')
    ],
    validateRequest,
    async(req:Request, res:Response)=>{
        const orderId = req.body.orderId;
        const order = await Order.findById(orderId);
        if(!order){
            throw new NotFoundError();
        }
        //TODO: currently it is only possible to cancel an order 
        // add the functionality to update order price.

        const orderStatus = req.body.status;
        const price = req.body.price;
        if (!orderStatus || orderStatus!=OrderStatus.Cancelled){ //&& !price
            throw new BadRequestError('explicit status is missing or invalid for update')//'at least one field is required for updating an order: price or status')
        }
        // A completed order can not be cancelled
        if(order.status == OrderStatus.Completed){
            throw new BadRequestError('Can not cancel order!')
        }

        if(req.jwtPayload!.id !== order.userId){
            throw new NotAuthorizedError(['not authorized.']);
        }
 

        // TODO: check removing save(); result: Do not remove the save u will loose versioning

        const orderToUpdate = await Order.findById(order.id);
        orderToUpdate!.set("status", OrderStatus.Cancelled)
        await orderToUpdate!.save(); 

        new EcommerceOrderCancelledPublisher(natsClient.client).publish({
            id: order.id,
            userId: order.userId,
            version: order.version,
            aiModelCard:{
                id:order.aiModelCard.id,
            }
        })

        res.status(200).send({order:orderToUpdate});


})

export { router as cancelEcommerceOrderRouter };