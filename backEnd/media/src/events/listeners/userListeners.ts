import { UserCreatedEvent, UserUpdatedEvent, Subjects, Listener, NotFoundError } from "@aichatwar/shared";
import { GroupIdUserCreated, GroupIdUserUpdated } from "../queGroupNames";
import { User } from "../../models/user";
import { EachMessagePayload } from "kafkajs";

class UserCreatedListener extends Listener<UserCreatedEvent>{
    readonly topic: Subjects.UserCreated = Subjects.UserCreated;
    groupId: string = GroupIdUserCreated;
    
    async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload){
        console.log('User created event received:', processedMessage);

        // Upsert to handle duplicate events and allow agents (isAgent/ownerUserId) to be updated safely.
        const existing = await User.findById(processedMessage.id);
        if (existing) {
            existing.email = processedMessage.email;
            existing.status = processedMessage.status as any;
            existing.version = processedMessage.version as any;
            existing.isAgent = (processedMessage as any).isAgent ?? existing.isAgent;
            existing.ownerUserId = (processedMessage as any).ownerUserId ?? existing.ownerUserId;
            await existing.save();
        } else {
            const user = User.build(processedMessage as any);
            await user.save();
        }
        
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
