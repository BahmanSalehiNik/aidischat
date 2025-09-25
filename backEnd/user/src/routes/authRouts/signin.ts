import express, {Request, Response} from "express";
import { body, validationResult } from "express-validator";
import { Password } from "../../utils/password";
import { User } from "../../models/user";
import { BadRequestError, validateRequest } from "@aichatwar/shared"
import jwt from "jsonwebtoken";


const router = express.Router();

router.post("/api/users/signin", [
        body("email")
        .isEmail()
        .withMessage("Email must be valid!"),
        body("password")
        .trim()
        .notEmpty()
        .withMessage("Invalid password!")
    ], validateRequest,
    async (req: Request, res: Response)=>{

        const {email, password}  = req.body
        const user = await User.findOne({email})
        console.log(user, "user")
        if (user){
        console.log(user)
        if(await Password.compare(user.password, password!)){
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

            return res.status(200).send(user)
        }else{
            console.log("invalid username password!")
            throw new BadRequestError("invalid username or password!");
            // throw new Error("Invalid username password combination!")
        }
        
        }else{
                console.log("invalid username or password")
                throw new BadRequestError("invalid username or password!");
        }

})

export { router as signinRouter };