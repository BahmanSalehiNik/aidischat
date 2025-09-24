import request from 'supertest';
import { app } from '../../app';


it('signout returns 200 on success and clears cookie', async()=>{
    const response = await request(app)
    .post('/api/users/signup')
    .send({
        email:'t1@aichatwar.com',
        password:'someValidPassword1'
    })
    .expect(201);
    expect(response.get('Set-Cookie')).toBeDefined();

     const responseSignOut = await request(app)
    .post('/api/users/signout')
    .send({})
    .expect(200);
    const cookies = responseSignOut.get('Set-Cookie')
    if (cookies){
        expect(cookies[0])
        .toEqual("session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; httponly")
    }else{
        throw new Error("No cookie found!")
    }

});