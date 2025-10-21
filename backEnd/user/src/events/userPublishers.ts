import {BasePublisher, Publisher, Subjects, UserCreatedEvent, UserUpdatedEvent } from "@aichatwar/shared";



class UserCreatedPublisher extends BasePublisher<UserCreatedEvent>{
    subject: Subjects.UserCreated = Subjects.UserCreated;

}

class UserUpdatedPublisher extends BasePublisher<UserUpdatedEvent>{
    subject: Subjects.UserUpdated = Subjects.UserUpdated;

}

class KafkaUserUpdatedPublisher extends Publisher<UserUpdatedEvent>{
    topic: Subjects.UserUpdated = Subjects.UserUpdated;

}

class KafkaUserCreatedPublisher extends Publisher<UserCreatedEvent>{
    topic: Subjects.UserCreated = Subjects.UserCreated;

}

export {UserCreatedPublisher, UserUpdatedPublisher, KafkaUserCreatedPublisher, KafkaUserUpdatedPublisher}