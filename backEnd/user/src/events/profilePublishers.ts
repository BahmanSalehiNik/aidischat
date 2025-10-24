import { Publisher, Subjects, ProfileCreatedEvent, ProfileUpdatedEvent } from "@aichatwar/shared";

class ProfileCreatedPublisher extends Publisher<ProfileCreatedEvent>{
    topic: Subjects.ProfileCreated = Subjects.ProfileCreated;
}

class ProfileUpdatedPublisher extends Publisher<ProfileUpdatedEvent>{
    topic: Subjects.ProfileUpdated = Subjects.ProfileUpdated;
}

export { ProfileCreatedPublisher, ProfileUpdatedPublisher }