import { UserCreatedEvent, UserUpdatedEvent, Subjects, Listener, NotFoundError } from "@aichatwar/shared";
import { GroupIdUserCreated, GroupIdUserUpdated } from "../queGroupNames";
import { User } from "../../models/user";
import { EachMessagePayload } from "kafkajs";

class UserCreatedListener extends Listener<UserCreatedEvent>{
    readonly topic: Subjects.UserCreated = Subjects.UserCreated;
    groupId: string = GroupIdUserCreated;
    
    async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload){
        console.log('User created event received:', processedMessage);
        const user = User.build(processedMessage);
        await user.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class UserUpdatedListener extends Listener<UserUpdatedEvent>{
    readonly topic: Subjects.UserUpdated = Subjects.UserUpdated;
    groupId: string = GroupIdUserUpdated;
    
    async onMessage(processedMessage: UserUpdatedEvent['data'], msg: EachMessagePayload){
        console.log('User updated event received:', processedMessage);
        const user = await User.findByEvent({id: processedMessage.id, version: processedMessage.version});
        if(!user){
            throw new NotFoundError();
        }
        user.status = processedMessage.status;
        await user.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

export { UserCreatedListener, UserUpdatedListener }
