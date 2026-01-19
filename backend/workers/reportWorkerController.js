import { createWorkerController } from "../utils/workerController.js";
import { startReportWorker } from "./reportWorker.js";

export const reportWorkerController = createWorkerController({
    name: "report",
    startWorker: startReportWorker,
    idleTimeout: 30_000,
    checkInterval: 5_000,
})