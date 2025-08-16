import request from 'supertest';
import { app } from '../../app';


it('current user set successfully after request', async()=>{
    const cookie = await global.signin();

    const responseCurrent = await request(app)
    .get("/api/users/currentuser")
    .set('Cookie', cookie)
    .send()
    .expect(200);
    expect(responseCurrent.body.currentUser.email).toEqual('someTestEmail@test.com');

})

it('current user set null not logged in', async()=>{

    const responseCurrent = await request(app)
    .get("/api/users/currentuser")
    .send()
    .expect(200);
    expect(responseCurrent.body.currentUser).toBeNull();

})