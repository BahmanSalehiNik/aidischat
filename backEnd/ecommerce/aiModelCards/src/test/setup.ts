import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

declare global{
    var signin: (id?:string, email?:string) => string[];
}

jest.mock('../nats-client');

let mongo: any
beforeAll(async ()=>{
    process.env.JWT_DEV = 'TESTJWTSECRET'
    mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri();
    await mongoose.connect(mongoUri);

})

beforeEach(async()=>{
    jest.clearAllMocks();
    if(mongoose.connection.db){
    const collections = await mongoose.connection.db.collections()
    for(let collection of collections){
        await collection.deleteMany({})
    }
}
})

afterAll(async()=>{
    if(mongo){
        await mongo.stop();
    }
    mongoose.connection.close();
})

global.signin = (id?:string, email?:string) => {
 const payload = {
    id: id || 'laksjdf234',
    email: email || 'fakeuser@somesite.com'
 }
 const token = jwt.sign(payload, process.env.JWT_DEV!)
 const jsonSession = JSON.stringify({jwt: token});
 const base64Cookie = Buffer.from(jsonSession).toString('base64')
 return [`session=${base64Cookie}`]

}