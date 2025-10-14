import { BaseListener,UserCreatedEvent, UserUpdatedEvent, Subjects } from "@aichatwar/shared";
import { PostQueueGroupeName } from "./../../queGroupNames";
import { Message } from "node-nats-streaming";
import { User } from "../../../models/user/user";


class UserCreatedListener extends BaseListener<UserCreatedEvent>{
    readonly subject: Subjects.UserCreated =  Subjects.UserCreated;
    queueGroupName: string = PostQueueGroupeName;
    async onMessage(processedMessage: UserCreatedEvent['data'] , msg: Message){
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
        const user = User.build(processedMessage);
        await user.save();
        msg.ack();
}
}


export { UserCreatedListener, UserUpdatedListener }