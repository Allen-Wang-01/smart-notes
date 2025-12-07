import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
let __dirname = path.dirname(__filename)

// Walk up until we find "backend"
while (path.basename(__dirname) !== "backend") {
    const parent = path.dirname(__dirname);
    if (parent === __dirname) break; // avoid infinite loop
    __dirname = parent;
}

const LOG_DIR = path.join(__dirname, 'logs') // always inside backend/logs

// Ensure logs folder exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
}

export function writeLog(noteId, message) {
    const filePath = path.join(LOG_DIR, `note-${noteId}.log`);

    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;

    fs.appendFileSync(filePath, line, "utf8");
}

export function wlog(noteId, message) {
    console.log(`WORKER [${noteId}] → ${message}`);
    writeLog(noteId, message);
}