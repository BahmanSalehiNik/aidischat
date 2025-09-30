import { BaseListener,NotFoundError,ProfileCreatedEvent, ProfileUpdatedEvent, Subjects } from "@aichatwar/shared";
import { FriendshipQueueGroupeName } from "./queGroupNames";
import { Message } from "node-nats-streaming";
import { Profile } from "../../models/profile";
import { User } from "../../models/user";

class ProfileCreatedListener extends BaseListener<ProfileCreatedEvent>{
    readonly subject: Subjects.ProfileCreated =  Subjects.ProfileCreated;
    queueGroupName: string = FriendshipQueueGroupeName;
    async onMessage(processedMessage: ProfileCreatedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const user = await User.findById(processedMessage.user)
        if(!user){
            throw new NotFoundError();
        }

    const {
      username,
      fullName,
      bio,
      birthday,
      gender,
      location,
      profilePicture,
      coverPhoto,
      privacy,
    } = processedMessage
    
    let birthdayDate;
    if(birthday){
        birthdayDate = new Date(birthday)
    }
        const profile = Profile.add({
            id: processedMessage.id,
            user: user.id,
            username,
            fullName,
            bio,
            birthday:birthdayDate,
            gender,
            location,
            profilePicture,
            coverPhoto,
            privacy,
        }
        );
        await profile.save();
        msg.ack();
}
}



export { ProfileCreatedListener }