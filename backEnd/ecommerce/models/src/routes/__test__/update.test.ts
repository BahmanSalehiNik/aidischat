import request from "supertest";
import {app} from "../../app"
import { EcommerceModel } from "../../models/ecommerceModel";
import { Types } from "mongoose";



const createEcommerceModle =()=>{
    return (request(app).post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId:'fakeModelId', 
        price:23
    }))
}

it('tests returns 404 invalid modelId', async()=>{
    const randomModelID = new Types.ObjectId().toHexString()
    const responseUpdateNoModleCreated = await request(app)
    .put('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        id:randomModelID,
        ecommerceModelId:'fakemodelId',
        price: 234
    });
    expect(responseUpdateNoModleCreated.status).toEqual(404);

    
    const createResponse = await createEcommerceModle();
    const fakeModleId = createResponse.body.data.id
    expect(createResponse.status).toEqual(201)
    const responseRetrieve = await request(app)
    .get(`/api/ecommerce/models/${fakeModleId}`)
    .send();
    expect(responseRetrieve.status).toEqual(200);

 
    await createEcommerceModle();
    const responseUpdate = await request(app)
    .put('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        id:randomModelID,
        ecommerceModelId:'fakemodelId',
        price: 235
    });
    expect(responseUpdate.status).toEqual(404);


})
it('tests returns 401 if not logged in', async()=>{
    await createEcommerceModle();
    const randomModelID = new Types.ObjectId().toHexString()
    const responseUpdate = await request(app)
    .put('/api/ecommerce/models')
    .send({
        id:randomModelID,
        ecommerceModelId:'fakemodelId',
        price: 236
    });
    expect(responseUpdate.status).toEqual(401);

})
it('tests returns 403 if logged in but not this users currentmodel', async()=>{
    const newModel = await createEcommerceModle();
    const responseUpdate = await request(app)
    .put('/api/ecommerce/models')
    .set('Cookie', global.signin('anotheruserId', 'anotherEmail@email.com'))
    .send({
        id:newModel.body.data.id,
        ecommerceModelId:'fakemodelId',
        price: 237
    });
    expect(responseUpdate.status).toEqual(401);

})
// it('tests return 400 with invalid price', async()=>{})
// it('tests return 400 with invalid ecommerceModelId', async()=>{}) 
it('tests return 200 with valid ecommerceModelId', async()=>{
    const coockie = global.signin();
    const createRequest = await request(app).post('/api/ecommerce/models')
    .set('Cookie', coockie)
    .send({
        ecommerceModelId:'fakeModelId', 
        price:23
    })

    expect(createRequest.status).toEqual(201)
    const updateRequest = await request(app).put('/api/ecommerce/models')
    .set('Cookie', coockie)
    .send({
        id:createRequest.body.data.id,
        ecommerceModelId: 'fakeModelId',
        price: 444
    })
    expect(updateRequest.status).toEqual(200)
    const model = await EcommerceModel.findById(createRequest.body.data.id)
    const models = await EcommerceModel.find({})
    expect(model!.price).toEqual(444)
})
