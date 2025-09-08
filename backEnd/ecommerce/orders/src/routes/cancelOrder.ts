import express, {Request, Response} from "express";
import { BadRequestError, extractJWTPayload,loginRequired, NotAuthorizedError, NotFoundError, OrderStatus, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { natsClient } from "../nats-client";
import { Types } from "mongoose";
import { Order } from "../models/order";


const router = express.Router();

router.put("/api/ecommerce/orders",
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
 
        const updatedOrder = await Order.findByIdAndUpdate(order.id, {$set:{status: OrderStatus.Cancelled}}, {new:true});


        // TODO: check removing save();
        updatedOrder!.save(); 


        res.status(200).send({order:updatedOrder});


})

export { router as cancelEcommerceOrderRouter };