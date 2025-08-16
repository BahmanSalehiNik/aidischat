import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { app } from '../app';
import request from 'supertest';
import { sign } from 'crypto';


declare global{
    var signin: () => Promise<string[]>
}

let mongo: any
beforeAll(async ()=>{
    process.env.JWT_DEV = 'TESTJWTSECRET'
    mongo = await MongoMemoryServer.create();
    const mongoUri = mongo.getUri();
    await mongoose.connect(mongoUri);

})

beforeEach(async()=>{
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

global.signin = async () => {
    const email = "someTestEmail@test.com"
    const password = "someValidPassword123"

    const response = await request(app)
    .post("/api/users/signup")
    .send({
        email, password
    })
    .expect(201);

    const cookie = response.get('Set-Cookie');
    if(!cookie){
        throw new Error('cookie not received after signup!')
    }
    return cookie;
}