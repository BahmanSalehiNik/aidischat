import {BasePublisher, Subjects, ProfileCreatedEvent, ProfileUpdatedEvent } from "@aichatwar/shared";



class ProfileCreatedPublisher extends BasePublisher<ProfileCreatedEvent>{
    subject: Subjects.ProfileCreated = Subjects.ProfileCreated;

}

class ProfileUpdatedPublisher extends BasePublisher<ProfileUpdatedEvent>{
    subject: Subjects.ProfileUpdated = Subjects.ProfileUpdated;

}

export {ProfileUpdatedPublisher, ProfileCreatedPublisher}