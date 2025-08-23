import request from "supertest";
import {app} from "../../app"
import { EcommerceModel } from "../../models/ecommerceModel";


it('has a rout handler listening to /api/ecommerce/models post', async()=>{})
it('login required', async()=>{
    const response = await request(app).post('/api/ecommerce/models').send({});
    expect(response.status).not.toEqual(404);
})
it('login required to create a an ecommerce model', async()=>{
    const response  = await request(app)
    .post('/api/ecommerce/models')
    .send({
        ecommerceModelId:'asdf', 
        price:23
    });
    expect(response.status).toEqual(401)

    const responseEmptyBody  = await request(app)
    .post('/api/ecommerce/models')
    .send({});
    expect(responseEmptyBody.status).toEqual(401)
})
it('returns status code  other tahn 401 with signedin user', async()=>{
    const cookie = global.signin();
    const response  = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', cookie)
    .send({});
    expect(response.status).not.toEqual(401)
})

it('returns error if invalid ecommerceModelId is provided', async()=>{
    const response = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: '',
        price: 34
    })

    expect(response.status).toEqual(400)

    const responseNoIdField = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        price: 34
    })

    expect(responseNoIdField.status).toEqual(400)
})
it('returns error if invalid price is provided', async()=>{
    const response = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'someId24',
        price: undefined
    })

    expect(response.status).toEqual(400)

    const responseNoPrice = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'someId3',
    })

    expect(responseNoPrice.status).toEqual(400)

    const responseInvalidPrice = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'someId4',
        price: 'asdf'
    })

    expect(responseInvalidPrice.status).toEqual(400)

        const responseInvalidNegativePrice = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'someId4',
        price: -1
    })

    expect(responseInvalidNegativePrice.status).toEqual(400)

})
it('creates ecommerce-model with valid request', async()=>{
    let ecommerceModels = await EcommerceModel.find({})
    expect(ecommerceModels.length).toEqual(0);

    const response = await request(app)
    .post('/api/ecommerce/models')
    .set('Cookie', global.signin())
    .send({
        ecommerceModelId: 'someId4',
        price: 234.0
    })
    expect(response.status).toEqual(201)
    ecommerceModels = await EcommerceModel.find({})
    expect(ecommerceModels.length).toEqual(1);
    expect(ecommerceModels[0].price).toEqual(234.0)
})