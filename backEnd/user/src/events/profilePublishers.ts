import {BasePublisher, Subjects, ProfileCreatedEvent, ProfileUpdatedEvent, Listener, Publisher } from "@aichatwar/shared";



class ProfileCreatedPublisher extends BasePublisher<ProfileCreatedEvent>{
    subject: Subjects.ProfileCreated = Subjects.ProfileCreated;

}

class ProfileUpdatedPublisher extends BasePublisher<ProfileUpdatedEvent>{
    subject: Subjects.ProfileUpdated = Subjects.ProfileUpdated;

}


class KafkaProfileCreatedPublisher extends Publisher<ProfileCreatedEvent>{
    topic: Subjects.ProfileCreated = Subjects.ProfileCreated;

}

class KafkaProfileUpdatedPublisher extends Publisher<ProfileUpdatedEvent>{
    topic: Subjects.ProfileUpdated = Subjects.ProfileUpdated;

}
export {ProfileUpdatedPublisher, 
    ProfileCreatedPublisher, 
    KafkaProfileCreatedPublisher, 
    KafkaProfileUpdatedPublisher}