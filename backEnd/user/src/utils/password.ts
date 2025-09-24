import {scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const asyncScript = promisify(scrypt);

class Password {
    static async hash(password: string){
        const salt = randomBytes(8).toString('hex');
        const passwordBuffer = (await asyncScript(password, salt, 64)) as Buffer;
        
        return `${passwordBuffer.toString('hex')}.${salt}`
    }
    static async compare(dbPassword: string, loginPassword: string){
        const [hashedDbPassword, salt] = dbPassword.split('.');
        const bufferLoginPassword = (await asyncScript(loginPassword, salt, 64)) as Buffer
        return bufferLoginPassword.toString('hex') === hashedDbPassword;

    }
}

export {Password}