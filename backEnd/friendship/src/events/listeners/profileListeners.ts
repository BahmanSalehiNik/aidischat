import { NotFoundError, ProfileCreatedEvent, ProfileUpdatedEvent, Listener, Subjects, Visibility } from "@aichatwar/shared";
import { GroupIdProfileCreated, GroupIdProfileUpdated } from "./queGroupNames";
import { Profile } from "../../models/profile";
import { User } from "../../models/user";
import { EachMessagePayload } from "kafkajs";
import mongoose from "mongoose";

class ProfileCreatedListener extends Listener<ProfileCreatedEvent>{
    readonly topic: Subjects.ProfileCreated = Subjects.ProfileCreated;
    groupId: string = GroupIdProfileCreated;
    
    async onMessage(processedMessage: ProfileCreatedEvent['data'], msg: EachMessagePayload){
        console.log('Profile created event received:', processedMessage);
        const user = await User.findById(processedMessage.user);
        if(!user){
            throw new NotFoundError();
        }
        
        const profile = Profile.add({
            id: processedMessage.id,
            user: user._id as mongoose.Types.ObjectId,
            username: processedMessage.username,
            fullName: processedMessage.fullName,
            profilePicture: processedMessage.profilePicture,
            privacy: {
                profileVisibility: processedMessage.privacy?.profileVisibility || Visibility.Public,
                postDefault: processedMessage.privacy?.postDefault || Visibility.Friends
            }
        });
        await profile.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

class ProfileUpdatedListener extends Listener<ProfileUpdatedEvent>{
    readonly topic: Subjects.ProfileUpdated = Subjects.ProfileUpdated;
    groupId: string = GroupIdProfileUpdated;
    
    async onMessage(processedMessage: ProfileUpdatedEvent['data'], msg: EachMessagePayload){
        console.log('Profile updated event received:', processedMessage);
        const profile = await Profile.findById(processedMessage.id);
        if(!profile){
            throw new NotFoundError();
        }
        
        profile.username = processedMessage.username;
        profile.fullName = processedMessage.fullName;
        profile.profilePicture = processedMessage.profilePicture;
        profile.privacy = {
            profileVisibility: processedMessage.privacy?.profileVisibility || Visibility.Public,
            postDefault: processedMessage.privacy?.postDefault || Visibility.Friends
        };
        await profile.save();
        
        // Manual acknowledgment - only after successful save
        await this.ack();
    }
}

export { ProfileCreatedListener, ProfileUpdatedListener }