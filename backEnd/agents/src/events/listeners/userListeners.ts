import { NotFoundError, UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent, Listener, Subjects } from "@aichatwar/shared";
import { User } from "../../models/user";
import { EachMessagePayload } from "kafkajs";

class UserCreatedListener extends Listener<UserCreatedEvent>{
    readonly topic: Subjects.UserCreated = Subjects.UserCreated;
    groupId: string = 'agents-user-created-service';
    
    async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload){
        console.log('User created event received:', processedMessage);
        
        const user = User.add({
            id: processedMessage.id,
            email: processedMessage.email,
            version: processedMessage.version,
            status: processedMessage.status
        });
        await user.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class UserUpdatedListener extends Listener<UserUpdatedEvent>{
    readonly topic: Subjects.UserUpdated = Subjects.UserUpdated;
    groupId: string = 'agents-user-updated-service';
    
    async onMessage(processedMessage: UserUpdatedEvent['data'], msg: EachMessagePayload){
        console.log('User updated event received:', processedMessage);
        const user = await User.findOne({ _id: processedMessage.id, isDeleted: false });
        if(!user){
            throw new NotFoundError();
        }
        
        user.email = processedMessage.email;
        user.status = processedMessage.status;
        await user.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class UserDeletedListener extends Listener<UserDeletedEvent>{
    readonly topic: Subjects.UserDeleted = Subjects.UserDeleted;
    groupId: string = 'agents-user-deleted-service';
    
    async onMessage(processedMessage: UserDeletedEvent['data'], msg: EachMessagePayload){
        console.log('User deleted event received:', processedMessage);
        const user = await User.findOne({ _id: processedMessage.id, isDeleted: false });
        if(!user){
            throw new NotFoundError();
        }
        
        user.isDeleted = true;
        user.deletedAt = new Date();
        await user.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

export { UserCreatedListener, UserUpdatedListener, UserDeletedListener }
