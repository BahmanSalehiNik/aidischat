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

            // Projection write: avoid OCC VersionError by using monotonic upsert.
            const incomingVersion = (processedMessage as any).version;
            // 1) Try to update existing doc if (and only if) this event is newer than stored version.
            await User.updateOne(
                {
                    _id: processedMessage.id,
                    $or: [{ version: { $exists: false } }, { version: { $lt: incomingVersion } }],
                },
                {
                    $set: {
                        email: processedMessage.email,
                        status: processedMessage.status as any,
                        version: incomingVersion,
                        isAgent: (processedMessage as any).isAgent ?? false,
                        ownerUserId: (processedMessage as any).ownerUserId,
                    },
                },
                { upsert: false }
            );

            // 2) Ensure the doc exists (insert only). This prevents duplicate-key upserts when the
            // version predicate doesn't match an existing document.
            await User.updateOne(
                { _id: processedMessage.id },
                {
                    $setOnInsert: {
                        email: processedMessage.email,
                        status: processedMessage.status as any,
                        version: incomingVersion,
                        isAgent: (processedMessage as any).isAgent ?? false,
                        ownerUserId: (processedMessage as any).ownerUserId,
                    },
                },
                { upsert: true }
            );
            
            // Manual acknowledgment - only after successful save
            await this.ack();
        } catch (error: any) {
            console.error(`[UserCreatedListener] Error processing user created event for ${processedMessage.id}:`, error);
            // Projection consumers should be resilient. Duplicate key errors can happen with concurrent upserts.
            // Treat as success and ack to avoid getting stuck on this offset.
            if (error?.code === 11000 || String(error?.message || '').includes('E11000')) {
                try {
                    await this.ack();
                } catch {}
                return;
            }
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
        // Projection write: avoid OCC errors; only move forward.
        const incomingVersion = (processedMessage as any).version;
        // 1) Update existing doc only if this event is newer.
        await User.updateOne(
          {
            _id: processedMessage.id,
            $or: [{ version: { $exists: false } }, { version: { $lt: incomingVersion } }],
          },
          {
            $set: {
              status: processedMessage.status as any,
              version: incomingVersion,
            },
          },
          { upsert: false }
        );

        // 2) Insert-only safeguard.
        await User.updateOne(
          { _id: processedMessage.id },
          {
            $setOnInsert: {
              status: processedMessage.status as any,
              version: incomingVersion,
            },
          },
          { upsert: true }
        );

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