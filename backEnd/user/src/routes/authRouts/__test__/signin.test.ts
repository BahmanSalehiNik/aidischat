import request from 'supertest';
import { app } from '../../../app';


it('test signin success returns 200', async()=>{
    await request(app)
    .post('/api/users/signup')
    .send({
        email:"test@test.com", 
        password:"abc1234567"
    })
    .expect(201);

    await request(app)
    .post('/api/users/signin')
    .send({
        email:"test@test.com",
        password: "abc1234567"
    })
    .expect(200);
})


it('test signin fails returns 400 ', async()=>{
    await request(app)
    .post('/api/users/signup')
    .send({
        email:"test@test.com", 
        password:"abc1234567"
    })
    .expect(201);

    await request(app)
    .post('/api/users/signin')
    .send({
        email:"test@test.com",
        password: "abc1234567"
    })
    .expect(200);
})

it('test signin fails returns 400 ', async()=>{
    await request(app)
    .post('/api/users/signup')
    .send({
        email:"test@test.com", 
        password:"abc1234567"
    })
    .expect(201);

    const response = await request(app)
    .post('/api/users/signin')
    .send({
        email:"test@test.com",
        password: "abc1234567"
    })
    .expect(200);                                                                                                                                                                                                                                            
    expect(response.get("Set-Cookie")).toBeDefined();
})