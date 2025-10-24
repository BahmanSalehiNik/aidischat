import { Publisher, Subjects, UserCreatedEvent, UserUpdatedEvent } from "@aichatwar/shared";

class UserCreatedPublisher extends Publisher<UserCreatedEvent>{
    topic: Subjects.UserCreated = Subjects.UserCreated;
}

class UserUpdatedPublisher extends Publisher<UserUpdatedEvent>{
    topic: Subjects.UserUpdated = Subjects.UserUpdated;
}

export { UserCreatedPublisher, UserUpdatedPublisher }