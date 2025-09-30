import { BaseListener,UserCreatedEvent, UserUpdatedEvent, Subjects } from "@aichatwar/shared";
import { FriendshipQueueGroupeName } from "./queGroupNames";
import { Message } from "node-nats-streaming";
import { User } from "../../models/user";


class UserCreatedListener extends BaseListener<UserCreatedEvent>{
    readonly subject: Subjects.UserCreated =  Subjects.UserCreated;
    queueGroupName: string = FriendshipQueueGroupeName;
    async onMessage(processedMessage: UserCreatedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const user = User.add(processedMessage);
        await user.save();
        msg.ack();
}
}

class UserUpdatedListener extends BaseListener<UserUpdatedEvent>{
    readonly subject: Subjects.UserUpdated =  Subjects.UserUpdated;
    queueGroupName: string = FriendshipQueueGroupeName;
    async onMessage(processedMessage: UserCreatedEvent['data'] , msg: Message){
        console.log(processedMessage)
        const user = User.add(processedMessage);
        await user.save();
        msg.ack();
}
}


export { UserCreatedListener, UserUpdatedListener }