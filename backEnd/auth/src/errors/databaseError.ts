import { CustomError } from "./customError";


class DatabaseError extends CustomError{
    data = 'Database error'
    statusCode = 500
    constructor(public details:string[]){
        super('Database error');

    Object.setPrototypeOf(this, DatabaseError.prototype);
    }

    serializeDetails() {
        return [{message: this.data}]

    }
}

export { DatabaseError }