import { Queue } from "bullmq";
import redis from "../config/redis.js";

const aiQueue = new Queue('ai-processing', {
    connection: redis,
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true, //clean up successful jobs
        removeOnFail: false,
    }
})

export default aiQueue;