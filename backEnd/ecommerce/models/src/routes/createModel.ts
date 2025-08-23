import express, {Request, Response} from "express";
import { extractJWTPayload,loginRequired, validateRequest } from "@aichatwar/shared";
import { body } from "express-validator";
import { EcommerceModel } from "../models/ecommerceModel";

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
            userId: JSON.stringify(req.jwtPayload),
            rank: req.body.rank | -1, //-1 means not ranked yet.
            modelId: req.body.ecommerceModelId,
            price: req.body.price
        })
    await newEcommerceModel.save();

    res.status(201).send({newEcommerceModel});
})

export { router as createEcommerceModelRouter };