import express, { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { User } from "../models/user";
import { RequestValidationError } from "../errors/requestValidationError";
import { BadRequestError } from "../errors/badRequestError"

const router = express.Router();

router.post("/api/users/signup", [
    body('email')
    .isEmail()
    .withMessage("Email must be valid!"),
    body("password")
    .trim()
    .isLength({min:8, max: 64})
    .withMessage("Password must be between 8 and 64 characters!")
],
async (req: Request, res: Response)=>{
    const errors = validationResult(req);

    if(!errors.isEmpty()){
        throw new RequestValidationError(errors.array());
    }
    const { email, password } = req.body;
    const userWithEmail = await User.findOne({email})
    if(userWithEmail){
        throw new BadRequestError("email already registered!");
    }

    const user =  User.add({email, password});
    await user.save();
    res.status(201).send(user);
    
})

export { router as signUpRouter };