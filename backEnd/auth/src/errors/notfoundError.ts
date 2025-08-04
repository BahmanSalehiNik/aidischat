import { CustomError } from "./customError";

class NotFoundError extends CustomError{
    data = "not found!"
    statusCode = 404;
    constructor(){
        super("Rout not found!");
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
    serializeDetails(): { message: string; field?: string; }[] {
        return [{message:"not found"}]
    }
}

export { NotFoundError }