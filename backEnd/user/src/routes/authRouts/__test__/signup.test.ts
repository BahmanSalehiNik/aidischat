import request from 'supertest';
import { app } from '../../../app';


it('signup returns 201 on success', async()=>{
    return request(app)
    .post('/api/users/signup')
    .send({
        email:'t1@aichatwar.com',
        password:'someValidPassword1'
    })
    .expect(201);
});

it('signup returns 400 with invalid email', async()=>{
    return request(app)
    .post('/api/users/signup')
    .send({
        email:'t2@invalid',
        password:'someValidPassword1'
    })
    .expect(400);
});

it('signup returns 400 with invalid (to short) pssword', async()=>{
    return request(app)
    .post('/api/users/signup')
    .send({
        email:'t2@email.com',
        password:'123'
    })
    .expect(400);
});


it('signup returns 400 on duplicate email', async()=>{
    await request(app)
    .post('/api/users/signup')
    .send({
        email:'t1@aichatwar.com',
        password:'someValidPassword1'
    })
    .expect(201);

    await request(app)
    .post('/api/users/signup')
    .send({
        email:'t1@aichatwar.com',
        password:'someValidPassword1'
    })
    .expect(400);
});

it('sets coockie following successfull signup', async()=>{
    const response = await request(app)
    .post('/api/users/signup')
    .send({
        email:'t1@aichatwar.com',
        password:'someValidPassword1'
    })
    .expect(201);
    expect(response.get('Set-Cookie')).toBeDefined();
})