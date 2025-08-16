import { CustomError } from "./customError";


class NotAuthorizedError extends CustomError{
    data = 'not Authorized'
    statusCode = 401
    constructor(public details:string[]){
        super('not Authorized');

    Object.setPrototypeOf(this, NotAuthorizedError.prototype);
    }

    serializeDetails() {
        return [{message: this.data}]

    }
}

export { NotAuthorizedError }