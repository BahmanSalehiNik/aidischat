/**
 * Lightweight interval-based scheduler that enqueues dataset jobs
 * once per hour. Keeps logic inside service so we can move to
 * k8s CronJob later if needed.
 */
import { DatasetGenerator } from "./dataset-generator";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

export class DatasetScheduler {
    private static intervalId?: NodeJS.Timeout;

    static start() {
        if (this.intervalId) return;
        this.intervalId = setInterval(() => {
            DatasetGenerator.scheduleEligibleAgents()
                .catch(err => console.error("Dataset scheduler error", err));
        }, CHECK_INTERVAL_MS);

        // Run once on startup
        DatasetGenerator.scheduleEligibleAgents()
            .catch(err => console.error("Dataset scheduler error", err));
    }
}

