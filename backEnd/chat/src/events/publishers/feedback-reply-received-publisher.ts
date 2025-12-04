import { Publisher, FeedbackReplyReceivedEvent, Subjects } from "@aichatwar/shared";

export class FeedbackReplyReceivedPublisher extends Publisher<FeedbackReplyReceivedEvent> {
    readonly topic = Subjects.FeedbackReplyReceived;
}

