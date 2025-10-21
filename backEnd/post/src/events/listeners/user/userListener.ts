import { BaseListener,UserCreatedEvent, UserUpdatedEvent, Subjects, Listener, NotFoundError } from "@aichatwar/shared";
import { PostQueueGroupeName, GroupIdUserCreated, GroupIdUserUpdated } from "./../../queGroupNames";
import { Message } from "node-nats-streaming";
import { EachMessagePayload } from "kafkajs";
import { User } from "../../../models/user/user";


class UserCreatedListener extends BaseListener<UserCreatedEvent>{
    readonly subject: Subjects.UserCreated =  Subjects.UserCreated;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: UserCreatedEvent['data'] , msg: Message){
        console.log('user created', processedMessage)
        console.log(processedMessage)
        const user = User.build(processedMessage);
        await user.save();
        msg.ack();
}
}

class UserUpdatedListener extends BaseListener<UserUpdatedEvent>{
    readonly subject: Subjects.UserUpdated =  Subjects.UserUpdated;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: UserCreatedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const user = await User.findByEvent({id:processedMessage.id,version:processedMessage.version});
        if(!user){
            throw new NotFoundError();
        }
        user.status = processedMessage.status;
        await user.save();
        msg.ack();
}
}

class KafkaUserCreatedListener extends Listener<UserCreatedEvent>{
    readonly topic: Subjects.UserCreated =  Subjects.UserCreated;
    groupId: string = GroupIdUserCreated;
        async onMessage(processedMessage: UserCreatedEvent['data'] , msg: EachMessagePayload){
        console.log('KAFKA user created event recieved!', processedMessage)
        // console.log(processedMessage)
        // const user = User.build(processedMessage);
        // await user.save();
        // msg.ack();
}
}

class KafkaUserUpdatedListener extends Listener<UserUpdatedEvent>{
    readonly topic: Subjects.UserUpdated =  Subjects.UserUpdated;
    groupId: string = GroupIdUserUpdated;
        async onMessage(processedMessage: UserUpdatedEvent['data'] , msg: EachMessagePayload){
        console.log('KAFKA user updated event recieved!', processedMessage)
        // console.log(processedMessage)
        // const user = User.build(processedMessage);
        // await user.save();
        // msg.ack();
}
}


export { UserCreatedListener,
     UserUpdatedListener,
      KafkaUserCreatedListener,
       KafkaUserUpdatedListener }