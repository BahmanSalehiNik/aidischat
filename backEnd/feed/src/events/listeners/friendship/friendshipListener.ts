import { NotFoundError, FriendshipAcceptedEvent, FriendshipRequestedEvent, FriendshipUpdatedEvent, Listener, Subjects } from "@aichatwar/shared";
import { GroupIdFreindshipAccepted, GroupIdFreindshipRequested, GroupIdFreindshipUpdated } from "../../queGroupNames";
import { Friendship } from "../../../models/friendship/freindship";
import { EachMessagePayload } from "kafkajs";

class FriendshipAcceptedListener extends Listener<FriendshipAcceptedEvent>{
    readonly topic: Subjects.FriendshipAccepted = Subjects.FriendshipAccepted;
    groupId: string = GroupIdFreindshipAccepted;
    
    async onMessage(processedMessage: FriendshipAcceptedEvent['data'], msg: EachMessagePayload){
        console.log('Friendship accepted event received:', processedMessage);
        const friendship = await Friendship.findOne({
            _id: processedMessage.id, version: processedMessage.version - 1
        });
        if (!friendship){
            throw new NotFoundError();
        }
        friendship.status = processedMessage.status;
        await friendship.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class FriendshipUpdatedListener extends Listener<FriendshipUpdatedEvent>{
    readonly topic: Subjects.FriendshipUpdated = Subjects.FriendshipUpdated;
    groupId: string = GroupIdFreindshipUpdated;
    
    async onMessage(processedMessage: FriendshipUpdatedEvent['data'], msg: EachMessagePayload){
        console.log('Friendship updated event received:', processedMessage);
        const friendship = await Friendship.findOne({
            _id: processedMessage.id, version: processedMessage.version - 1
        });
        if (!friendship){
            throw new NotFoundError();
        }
        friendship.status = processedMessage.status;
        await friendship.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class FriendshipRequestedListener extends Listener<FriendshipRequestedEvent>{
    readonly topic: Subjects.FriendshipRequested = Subjects.FriendshipRequested;
    groupId: string = GroupIdFreindshipRequested;
    
    async onMessage(processedMessage: FriendshipRequestedEvent['data'], msg: EachMessagePayload){
        console.log('Friendship requested event received:', processedMessage);
        const friendship = await Friendship.build(processedMessage);
        await friendship.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

export { 
    FriendshipAcceptedListener,
    FriendshipRequestedListener,
    FriendshipUpdatedListener
}