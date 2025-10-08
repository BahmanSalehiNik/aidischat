import { PostQueueGroupeName } from "../../queGroupNames";
import { Message } from "node-nats-streaming";
import { Friendship } from "../../../models/friendship/freindship"
import { BaseListener, 
    Subjects,
    FriendshipAcceptedEvent, 
    FriendshipRequestedEvent, 
    FriendshipUpdatedEvent, 
    NotFoundError} from "@aichatwar/shared";

class FreindshipAcceptedListener extends BaseListener<FriendshipAcceptedEvent>{
    readonly subject: Subjects.FriendshipAccepted =  Subjects.FriendshipAccepted;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: FriendshipAcceptedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const freindship = await Friendship.findOne({
            _id:processedMessage.id, version: processedMessage.version - 1
        });
        if (!freindship){
            throw new NotFoundError();
        }
        freindship.status = processedMessage.status
        await freindship.save();
        msg.ack();
}
}


class FreindshipUpdatedListener extends BaseListener<FriendshipUpdatedEvent>{
    readonly subject: Subjects.FriendshipUpdated =  Subjects.FriendshipUpdated;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: FriendshipUpdatedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const freindship = await Friendship.findOne({
            _id:processedMessage.id, version: processedMessage.version - 1
        });
        if (!freindship){
            throw new NotFoundError();
        }
        freindship.status = processedMessage.status
        await freindship.save();
        msg.ack();
}
}

class FreindshipRequestedListener extends BaseListener<FriendshipRequestedEvent>{
    readonly subject: Subjects.FriendshipRequested =  Subjects.FriendshipRequested;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: FriendshipRequestedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const freindship = await Friendship.build(processedMessage);
        await freindship.save();
        msg.ack();
}
}
//TODO: update friendship updated


// class AiModelCardUpdatedListener extends BaseListener<EcommerceModelUpdatedEvent>{
//     readonly subject: Subjects.EcommerceModelUpdated =  Subjects.EcommerceModelUpdated;
//     queueGroupName: string = orderAiModelCardQueueGroupeName;
//     async onMessage(processedMessage: EcommerceModelUpdatedEvent['data'] , msg: Message){
//         const {id, rank, modelId, price, userId, version} = processedMessage;
//         //const updatedCard  = await AiModelCard.find({cardRefId:id, version: version - 1})[0];
//         const tempEvent = {id, version}
//         const updatedCard  = await AiModelCard.findByEvent(tempEvent);
//         if (!updatedCard){
//             throw new Error('ai model card not found! or did it?')
//         }
//         updatedCard.set( 
//         { 
//             // modelRefId:modelId, 
//             // userId:JSON.parse(userId).id, 
//             price:price,
//             rank: rank
//         }
//     )
//         await updatedCard.save()

//         msg.ack();
//     }
// }


export { FreindshipAcceptedListener, FreindshipRequestedListener, FreindshipUpdatedListener }