import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
    id: string;
    email: string;
}


declare global{
    namespace Express {
        interface Request{
        jwtPayload?:JwtPayload;
        }
    }
};


const extractJWTPayload = (
    req: Request, 
    res: Response, 
    next: NextFunction
)=>{
    
    if (!req.session?.jwt){
        return next();
    }

    try{
    const payload = jwt.verify(
        req.session!.jwt, 
        process.env.JWT_DEV!
    ) as JwtPayload

    req.jwtPayload = payload;
    }catch(error: any){
        console.log(error.message)   
    }
    next();
}

export { extractJWTPayload };