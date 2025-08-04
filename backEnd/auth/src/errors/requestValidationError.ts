import { CustomError } from "./customError";
import { ValidationError } from "express-validator";

class RequestValidationError extends CustomError {
    data = "Invalid request!"
    statusCode = 400
    constructor(public details: ValidationError[]){
        super('Invalid request');
    // extending a built in class
    Object.setPrototypeOf(this, RequestValidationError.prototype);
    }

    serializeDetails(){
        return this.details.map(detail=>{
            if(detail.type=='field'){
                return {message:detail.msg, field:detail.path}
            }
            return {message:detail.msg};
        });
    }
}

export { RequestValidationError }