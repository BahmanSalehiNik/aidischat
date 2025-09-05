import express, {Request, Response} from "express";
import { EcommerceModel } from "../models/ecommerceModel";
import { NotFoundError } from "@aichatwar/shared";
import { Types } from "mongoose";

const router = express.Router();


router.get("/api/ecommerce/models/:id",async(req:Request, res:Response)=>{

    const ecommerceModel = await EcommerceModel.findById(req.params.id) 
    console.log(ecommerceModel, "secret")
    if(!ecommerceModel){
        throw new NotFoundError();
    }
    res.status(200).send(ecommerceModel)
})

export { router as retrieveEcommerceModelByIdRouter };