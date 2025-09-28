import {BasePublisher, Subjects, UserCreatedEvent, UserUpdatedEvent } from "@aichatwar/shared";



class UserCreatedPublisher extends BasePublisher<UserCreatedEvent>{
    subject: Subjects.UserCreated = Subjects.UserCreated;

}

class UserUpdatedPublisher extends BasePublisher<UserUpdatedEvent>{
    subject: Subjects.UserUpdated = Subjects.UserUpdated;

}

export {UserCreatedPublisher, UserUpdatedPublisher}