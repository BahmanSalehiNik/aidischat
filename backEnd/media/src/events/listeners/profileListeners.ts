import { ProfileCreatedEvent, ProfileUpdatedEvent, Subjects, Listener, NotFoundError, Visibility } from "@aichatwar/shared";
import { GroupIdProfileCreated, GroupIdProfileUpdated } from "../queGroupNames";
import { Profile } from "../../models/profile";
import { User } from "../../models/user";
import { EachMessagePayload } from "kafkajs";

class ProfileCreatedListener extends Listener<ProfileCreatedEvent>{
    readonly topic: Subjects.ProfileCreated = Subjects.ProfileCreated;
    groupId: string = GroupIdProfileCreated;
    
    async onMessage(processedMessage: ProfileCreatedEvent['data'], msg: EachMessagePayload){
        console.log('Profile created event received:', processedMessage);
        
        const user = await User.findById(processedMessage.user);
        if(!user){
            throw new NotFoundError();
        }
        
        const profile = await Profile.build({
            id: processedMessage.id,
            userId: user.id,
            username: processedMessage.username,
            avatarUrl: processedMessage.profilePicture?.url,
            privacy: {
                profileVisibility: processedMessage.privacy?.profileVisibility || Visibility.Public,
                postDefault: processedMessage.privacy?.postDefault || Visibility.Friends
            },
            version: processedMessage.version
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
        profile.avatarUrl = processedMessage.profilePicture?.url;
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
