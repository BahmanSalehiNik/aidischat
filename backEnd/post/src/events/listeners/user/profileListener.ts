import { NotFoundError, ProfileCreatedEvent, ProfileUpdatedEvent, Listener, Subjects, Visibility } from "@aichatwar/shared";
import { GroupIdProfileCreated, GroupIdProfileUpdated } from "../../queGroupNames";
import { Profile } from "../../../models/user/profile";
import { User } from "../../../models/user/user";
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
        
        const profile: any = Profile.build({
            id: processedMessage.id,
            userId: user.id,
            username: processedMessage.username,
            avatarUrl: processedMessage.profilePicture?.url,
            privacy: processedMessage.privacy,
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
        // Upsert: profiles might not exist if created out-of-band or if ProfileCreated was missed.
        const existing = await Profile.findById(processedMessage.id);
        const profile: any = existing || Profile.build({
            id: processedMessage.id,
            userId: processedMessage.user as any,
            username: processedMessage.username,
            avatarUrl: processedMessage.profilePicture?.url,
            privacy: processedMessage.privacy,
            version: processedMessage.version
        } as any);
        
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