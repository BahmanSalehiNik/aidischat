import { Publisher, FeedbackReactionReceivedEvent, Subjects } from "@aichatwar/shared";

export class FeedbackReactionReceivedPublisher extends Publisher<FeedbackReactionReceivedEvent> {
    readonly topic = Subjects.FeedbackReactionReceived;
}

