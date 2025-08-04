import { Request, Response, NextFunction } from "express"
import { CustomError } from "../errors/customError";

`common structure for errors:
{
  errors:{
    message: string, field?: string
  }[]
}
`

export const errorHandler = (
    err: Error, 
    req: Request, 
    res: Response, 
    next: NextFunction
) =>{
console.log("Error:", err);
if (err instanceof CustomError) {
    return res.status(err.statusCode).send({errors: err.serializeDetails()})
}
    return res.status(400).send({
        errors: [{message:"an error occurred!"}]
    })
}
