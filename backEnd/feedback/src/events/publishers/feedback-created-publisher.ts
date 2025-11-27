import { Publisher, FeedbackCreatedEvent, Subjects } from "@aichatwar/shared";

export class FeedbackCreatedPublisher extends Publisher<FeedbackCreatedEvent> {
    readonly topic = Subjects.FeedbackCreated;
}

