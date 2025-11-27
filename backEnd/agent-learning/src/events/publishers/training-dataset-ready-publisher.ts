import { Publisher, TrainingDatasetReadyEvent, Subjects } from "@aichatwar/shared";

export class TrainingDatasetReadyPublisher extends Publisher<TrainingDatasetReadyEvent> {
    readonly topic = Subjects.TrainingDatasetReady;
}

