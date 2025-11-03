import express, { Request, Response } from "express";
import { body } from "express-validator";
import jwt from "jsonwebtoken";

import { validateRequest, BadRequestError } from "@aichatwar/shared";
import { User } from "../../models/user";
import {kafkaWrapper} from "../../kafka-client";
import { UserCreatedPublisher } from "../../events/userPublishers";


const router = express.Router();

router.post("/api/users/signup", [
    body('email')
    .isEmail()
    .withMessage("Email must be valid!"),
    body("password")
    .trim()
    .isLength({min:8, max: 64})
    .withMessage("Password must be between 8 and 64 characters!")
],validateRequest,
async (req: Request, res: Response)=>{

    const { email, password } = req.body;
    const userWithEmail = await User.findOne({email})
    if(userWithEmail){
        throw new BadRequestError("email already registered!");
    }

    const user =  User.add({email, password});
    await user.save();

    await new UserCreatedPublisher(kafkaWrapper.producer).publish({
        id:user.id,
        email:user.email,
        status:user.status,
        version: user.version
    })
    
    // creating the jwt 
    const userJwt = jwt.
    sign(
        {id: user.id, email: user.email}, 
        process.env.JWT_DEV! 
    );
    console.log(userJwt)

    req.session = {
        jwt: userJwt
    };

    // Return user with token for mobile clients
    res.status(201).send({
        ...user.toJSON(),
        token: userJwt
    });
    
})

export { router as signUpRouter };