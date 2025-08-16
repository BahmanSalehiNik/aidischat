import { CustomError } from "./customError";

class BadRequestError extends CustomError{
    data= "Bad Request!"
    statusCode= 400
    constructor(public details:string){
        super(details)
        Object.setPrototypeOf(this, BadRequestError.prototype)
    }
    serializeDetails(): { message: string; field?: string; }[] {
        return [
            {message:
                this.details
        }]
    };

}

export { BadRequestError }