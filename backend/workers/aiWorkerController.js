import { createWorkerController } from "../utils/workerController.js";
import { startAIWorker } from "./aiWorker.js";

export const aiWorkerController = createWorkerController({
    name: "ai",
    startWorker: startAIWorker,
    idleTimeout: 20_000, // 20s idle auto shutdown
    checkInterval: 5_000, // check every 5s
})