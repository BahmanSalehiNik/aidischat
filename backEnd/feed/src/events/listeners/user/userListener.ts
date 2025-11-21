import { UserCreatedEvent, UserUpdatedEvent, UserDeletedEvent, Subjects, Listener, NotFoundError } from "@aichatwar/shared";
import { GroupIdUserCreated, GroupIdUserUpdated } from "./../../queGroupNames";
import { User } from "../../../models/user/user";
import { UserStatus } from "../../../models/user-status";
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