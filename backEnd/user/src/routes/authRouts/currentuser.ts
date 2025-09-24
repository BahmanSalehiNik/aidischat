import express, {Request, Response} from "express";
import { extractJWTPayload } from "@aichatwar/shared";


const router = express.Router();

router.get("/api/users/currentuser", 
    extractJWTPayload,
    (req:Request, res:Response)=>{
    res.send({currentUser: req.jwtPayload || null})

})

export { router as currentUserRouter };