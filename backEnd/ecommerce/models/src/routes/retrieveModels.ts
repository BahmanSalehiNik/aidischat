import express, {Request, Response} from "express";
import { EcommerceModel } from "../models/ecommerceModel";

const router = express.Router();

router.get("/api/ecommerce/models",async(req:Request, res:Response)=>{
    const ecommerceModels = await EcommerceModel.find({}) 
    res.status(200).send(ecommerceModels.map(model=>model.toJSON()))
})

router.get("/api/ecommerce/models/:id",async(req:Request, res:Response)=>{
    const ecommerceModels = await EcommerceModel.find({}) 
    res.status(200).send(ecommerceModels.map(model=>model.toJSON()))
})

export { router as retrieveEcommerceModelRouter };