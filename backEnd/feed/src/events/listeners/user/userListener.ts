import { UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent, Subjects, Listener, NotFoundError } from "@aichatwar/shared";
import { GroupIdUserCreated, GroupIdUserUpdated } from "./../../queGroupNames";
import { User } from "../../../models/user/user";
import { UserStatus } from "../../../models/user-status";
import { EachMessagePayload } from "kafkajs";

class UserCreatedListener extends Listener<UserCreatedEvent>{
    readonly topic: Subjects.UserCreated = Subjects.UserCreated;
    groupId: string = GroupIdUserCreated;
    
    async onMessage(processedMessage: UserCreatedEvent['data'], msg: EachMessagePayload){
        try {
            console.log('User created event received:', processedMessage);
            
            // Check if user already exists (handle duplicate events)
            const existing = await User.findOne({ _id: processedMessage.id });
            if (existing) {
                // Update existing user
                existing.email = processedMessage.email;
                existing.version = processedMessage.version;
                existing.status = processedMessage.status;
                existing.isAgent = processedMessage.isAgent ?? false;
                existing.ownerUserId = processedMessage.ownerUserId;
                await existing.save();
                console.log(`[UserCreatedListener] Updated existing user: ${processedMessage.id}`);
            } else {
                // Create new user
                const user = User.build(processedMessage);
                await user.save();
                console.log(`[UserCreatedListener] Created new user: ${processedMessage.id}`);
            }
            
            // Manual acknowledgment - only after successful save
            await this.ack();
        } catch (error: any) {
            console.error(`[UserCreatedListener] Error processing user created event for ${processedMessage.id}:`, error);
            // Don't ack on error - let Kafka retry or move to DLQ
            throw error;
        }
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

        // Update user status projection for filtering
        const isSuggestible =
          processedMessage.status !== 'deleted' &&
          processedMessage.status !== 'suspended' &&
          processedMessage.status !== 'banned';

        await UserStatus.updateOne(
          { userId: processedMessage.id },
          {
            $set: {
              status: processedMessage.status,
              isDeleted: processedMessage.status === 'deleted',
              isSuggestible,
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class UserDeletedListener extends Listener<UserDeletedEvent>{
    readonly topic: Subjects.UserDeleted = Subjects.UserDeleted;
    groupId: string = "feed-user-deleted";
    
    async onMessage(processedMessage: UserDeletedEvent['data'], msg: EachMessagePayload){
        console.log('User deleted event received:', processedMessage);
        
        // Update user status projection
        await UserStatus.updateOne(
          { userId: processedMessage.id },
          {
            $set: {
              status: 'deleted',
              isDeleted: true,
              isSuggestible: false,
              deletedAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true }
        );
        
        // Manual acknowledgment
        await this.ack();
    }
}

export { UserCreatedListener, UserUpdatedListener, UserDeletedListener }