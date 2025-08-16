import express, {Request, Response} from "express";
import { extractJWTPayload } from "../middlewares/jwt-extractor";


const router = express.Router();

router.get("/api/users/currentuser", 
    extractJWTPayload,
    (req:Request, res:Response)=>{
    res.send({currentUser: req.jwtPayload || null})

})

export { router as currentUserRouter };