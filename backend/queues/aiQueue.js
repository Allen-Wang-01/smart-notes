import { Queue } from "bullmq";
import { getRedis } from "../config/redis.js";

let aiQueue

export function getAIQueue() {
    if (aiQueue) return aiQueue

    aiQueue = new Queue('ai-processing', {
        connection: getRedis(),
        defaultJobOptions: {
            attempts: 2, //Retry failed jobs up to 2 times
            backoff: {
                type: 'exponential', // Exponential backoff strategy
                delay: 2000 // Initial delay of 2 seconds (2s → 4s → 8s → 16s → 32s)
            },
            removeOnComplete: true, //clean up successful jobs
            removeOnFail: 20, // keep the last 20 failed jobs for debuging
        }
    })

    return aiQueue
}