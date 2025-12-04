import { NotFoundError, UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent, Listener, Subjects } from "@aichatwar/shared";
import { User } from "../../models/user";
import { EachMessagePayload } from "kafkajs";
import { GroupIdUserCreated, GroupIdUserUpdated, GroupIdUserDeleted } from "./queGroupNames";

class UserCreatedListener extends Listener<UserCreatedEvent>{
    readonly topic: Subjects.UserCreated = Subjects.UserCreated;
    readonly groupId = GroupIdUserCreated;
    protected fromBeginning: boolean = true; // Read from beginning to avoid missing messages
    
    async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload){
        console.log('User created event received:', processedMessage);
        
        try {
            // Check if user already exists (use findOne with _id to avoid ObjectId casting)
            const existing = await User.findOne({ _id: processedMessage.id });
            
            if (existing) {
                // Update existing user - version will be checked by updateIfCurrentPlugin on save()
                existing.email = processedMessage.email;
                existing.version = processedMessage.version;
                existing.status = processedMessage.status;
                existing.isAgent = processedMessage.isAgent ?? false;
                existing.ownerUserId = processedMessage.ownerUserId;
                existing.isDeleted = false;
                existing.deletedAt = undefined;
                await existing.save();
                console.log(`[UserCreatedListener] Updated existing user: ${processedMessage.id}`);
            } else {
                // Create new user using User.add() which properly handles string _id
                // Note: For UserCreated events, version checks aren't critical since it's a creation event
                const newUser = User.add({
                    id: processedMessage.id,
                    email: processedMessage.email,
                    version: processedMessage.version,
                    status: processedMessage.status,
                    isAgent: processedMessage.isAgent ?? false,
                    ownerUserId: processedMessage.ownerUserId,
                });
                await newUser.save();
                console.log(`[UserCreatedListener] Created new user: ${processedMessage.id}`);
            }
            
            // Manual acknowledgment - only after successful save
            await this.ack();
        } catch (error: any) {
            console.error(`[UserCreatedListener] Error processing user created event:`, error);
            throw error;
        }
    }
}

class UserUpdatedListener extends Listener<UserUpdatedEvent>{
    readonly topic: Subjects.UserUpdated = Subjects.UserUpdated;
    readonly groupId = GroupIdUserUpdated;
    
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
    readonly groupId = GroupIdUserDeleted;
    
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
