import request from "supertest";
import {app} from "../../app"
import { EcommerceModel } from "../../models/ecommerceModel";
import mongoose from "mongoose";


it('test retrieves all ecommerce models!', async()=>{
    let ecommerceModels;
    const response = await request(app)
    .get('/api/ecommerce/models')
    .send();
    
    expect(response.status).toEqual(200);
    expect(response.body.length).toEqual(0);
    ecommerceModels = await EcommerceModel.find({});
    expect(ecommerceModels.length).toEqual(0);
    
    const createModelResponse = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'someId4',
        price: 234.0
    });
    expect(createModelResponse.status).toEqual(201);

    ecommerceModels = await EcommerceModel.find({});
    expect(ecommerceModels.length).toEqual(1);
    const responseModel = await request(app)
    .get('/api/ecommerce/models')
    .send();
    expect(responseModel.body.length).toEqual(1);
    expect(responseModel.body[0].modelId).toEqual('someId4')

})

it('test retrieves returns 404 if ecommerce models by id is not found', async()=>{
    const fakeId = new mongoose.Types.ObjectId().toHexString();
    let ecommerceModels;
    const response = await request(app)
    .get(`/api/ecommerce/models/${fakeId}`)
    .send();
    expect(response.status).toEqual(404);
    ecommerceModels = await EcommerceModel.find({id:fakeId});
    expect(ecommerceModels.length).toEqual(0);
    


})

it('test retrieves ecommerce models by id', async()=>{
    let ecommerceModel;
    const createModelResponse = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'modelId333',
        price: 234.0
    });
    expect(createModelResponse.status).toEqual(201);

    const savedModelId = createModelResponse.body.data.id;

    ecommerceModel = await EcommerceModel.findById(savedModelId);

    expect(ecommerceModel).not.toBeNull()
    const responseModel = await request(app)
    .get(`/api/ecommerce/models/${savedModelId}`)
    .send();

    expect(responseModel.body.id).toEqual(savedModelId)
    expect(responseModel.body.modelId).toEqual('modelId333')
})