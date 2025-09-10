import { EcommerceModel } from "../ecommerceModel";
import { Types} from "mongoose";

it('impolements optimistic concurrncy control ', async()=>{
    // creating an instance of the aiModelCard (AKA EcommerceModel for now)
    const card  = EcommerceModel.add({
        modelId:'fakeModelId',
        userId: 'user1Id',
        price: 111,
        rank: -1
        })
    

    await card.save();

    //fetching it two times

    const firstFetch = await EcommerceModel.findById(card.id);
    const secondFetch = await EcommerceModel.findById(card.id);
    
    
    // updating the first fetch

    firstFetch!.set("price", 222);


    // updating the second fetch
    
    secondFetch!.set("price", 333);

    // saving the changes
    await firstFetch!.save()
    console.log(firstFetch);
    try{
    await secondFetch!.save()
    }catch(err){
        return;
    }

    throw new Error('should not get to this point!')
})

it('version number increments by one after each save', async()=>{
    const card = EcommerceModel.add({
        modelId:'fakeModelId',
        userId: 'user1Id',
        price: 111,
        rank: -1
    })

    await card.save();
    expect(card.version).toEqual(0);
    await card.save();
    expect(card.version).toEqual(1);
    await card.save();
    expect(card.version).toEqual(2);
})