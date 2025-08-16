import {Request, Response, NextFunction} from 'express';
import { NotAuthorizedError } from '../errors/notAuthorizedError';


const loginRequired = async (
    req: Request, 
    res: Response, 
    next: NextFunction
)=>{
    if(!req.jwtPayload){
        throw new NotAuthorizedError(['not authorized']);
    }
    next();
}

export { loginRequired }