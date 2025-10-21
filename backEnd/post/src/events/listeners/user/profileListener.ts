import { BaseListener, NotFoundError, ProfileCreatedEvent, 
  ProfileUpdatedEvent, Subjects, Visability, Listener, 
  UserCreatedEvent} from "@aichatwar/shared";
import { PostQueueGroupeName, GroupIdProfileCreated } from "./../../queGroupNames";
import { Message } from "node-nats-streaming";
import { Profile } from "../../../models/user/profile";
import { User } from "../../../models/user/user";
import { EachMessagePayload } from "kafkajs";




class ProfileCreatedListener extends BaseListener<ProfileCreatedEvent>{
    readonly subject: Subjects.ProfileCreated =  Subjects.ProfileCreated;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: ProfileCreatedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const user = await User.findById(processedMessage.user)
        if(!user){
            throw new NotFoundError();
        }
        //Todo: add location to have feed algorithm based on location added
    const {
      username,
      profilePicture,
    //   coverPhoto,
      privacy,
      version
    } = processedMessage
    
        const profile = await Profile.build({
            id: processedMessage.id,
            userId: user.id,
            username,
            avatarUrl:profilePicture?.url,
            // coverPhoto,
            privacy:privacy,
            version
        }
        );
        await profile.save();
        msg.ack();

        //   id: string;
//   userId: string;
//   avatarUrl?: string;
//   visibility: Visability;
//   version: number;
}
}

class KafkaProfileCreatedListener extends Listener<ProfileCreatedEvent>{
    readonly topic: Subjects.ProfileCreated =  Subjects.ProfileCreated;
    groupId: string = GroupIdProfileCreated;
    async onMessage(processedMessage: ProfileCreatedEvent['data'] , msg: EachMessagePayload){
        console.log('Kafka profile created', processedMessage)
    //     const user = await User.findById(processedMessage.user)
    //     if(!user){
    //         throw new NotFoundError();
    //     }
    //     //Todo: add location to have feed algorithm based on location added
    // const {
    //   username,
    //   profilePicture,
    // //   coverPhoto,
    //   privacy,
    //   version
    // } = processedMessage
    
    //     const profile = await Profile.build({
    //         id: processedMessage.id,
    //         userId: user.id,
    //         username,
    //         avatarUrl:profilePicture?.url,
    //         // coverPhoto,
    //         privacy:privacy,
    //         version
    //     }
    //     );
    //     await profile.save();
        // TODO: Add manual ack
        // msg.ack();

        //   id: string;
//   userId: string;
//   avatarUrl?: string;
//   visibility: Visability;
//   version: number;
}
}




export { ProfileCreatedListener, KafkaProfileCreatedListener }