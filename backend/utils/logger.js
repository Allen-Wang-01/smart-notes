/**
 * Universal structured logger
 * 
 * Development (NODE_ENV !== 'production')
 *  - Coloured, readable output to console
 *  - Appends to backend/logs/<context>-<id>.log  for easy per-job inspection
 *  - Sensitive payloads (prompts, LLM responses) are logged in full
 *  * Production   (NODE_ENV === 'production')
 *   - JSON lines to stdout only (Fly.io / any log aggregator can ingest this)
 *   - No file I/O
 *   - Sensitive payloads are never written (user privacy)
 *
 *   Usage — general module
 *   ----------------------
 *   import { createLogger } from './logger.js'
 *   const log = createLogger('report-ai')
 *   log.info('llm_started', { model: 'gpt-5-nano' })
 *
 *   Usage — BullMQ job
 *   ------------------
 *   import { createJobLogger } from './logger.js'
 *   const log = createJobLogger(job)
 *   log.info('notes_fetched', { count: 4 })
 *   log.prompt('snapshot sent to LLM', snapshot)   // dev only
 *   log.llm('LLM response', llmResult)             // dev only
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Environment
const IS_PROD = process.env.NODE_ENV === 'production'

// log directory (dev only)
function findBackendDir() {
    let dir = path.dirname(fileURLToPath(import.meta.url))
    while (path.basename(dir) !== 'backend') {
        const parent = path.dirname(dir)
        if (parent === dir) return dir // fallback: project root
        dir = parent
    }
    return dir
}

const LOG_DIR = path.join(findBackendDir(), 'logs')

if (!IS_PROD && !fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true })
}

// console colours (dev only)

const COLOUR = {
    reset: '\x1b[0m',
    grey: '\x1b[90m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m',
}

const LEVEL_COLOUR = {
    info: COLOUR.cyan,
    warn: COLOUR.yellow,
    error: COLOUR.red,
    prompt: COLOUR.magenta,
    llm: COLOUR.magenta,
    debug: COLOUR.grey,
}

// core write 
function _write(level, context, stage, fields = {}, fileKey = null) {
    const ts = new Date().toLocaleString('ja-JP', { hour12: false })
    const entry = { ts, level, context, stage, ...fields }

    if (IS_PROD) {
        process.stdout.write(JSON.stringify(entry) + '\n')
        return
    }

    // Coloured console line
    const colour = LEVEL_COLOUR[level] ?? COLOUR.reset
    const extras = Object.keys(fields).length
        ? '  ' + JSON.stringify(fields, null, 0)
        : ''

    console.log(
        `${COLOUR.grey}${ts}${COLOUR.reset} ` +
        `${colour}[${level.toUpperCase().padEnd(6)}]${COLOUR.reset} ` +
        `${COLOUR.cyan}${context}${COLOUR.reset} › ${stage}` +
        `${COLOUR.grey}${extras}${COLOUR.reset}`
    )

    // File output (dev only)
    if (fileKey) {
        const filePath = path.join(LOG_DIR, `${fileKey}.log`)
        const fileLine = (
            `[${ts}] [${level.toUpperCase()}] ${stage}` +
            (Object.keys(fields).length ? '\n' + JSON.stringify(fields, null, 2) : '') +
            '\n'
        )
        try {
            fs.appendFileSync(filePath, fileLine, 'utf8')
        } catch {
            // Never let logging crash the application
        }
    }
}

// Logger factory

/**
 * Create a general-purpose logger.
 * 
 * @param {string} context module name, e.g. 'report-ai', 'python-runner'
 * @param {string=} fileKey dev only - logs also written to backend/logs/<fileKey>.log
 */

export function createLogger(context, fileKey = null) {
    return {
        info: (stage, fields = {}) => _write('info', context, stage, fields, fileKey),
        warn: (stage, fields = {}) => _write('warn', context, stage, fields, fileKey),
        error: (stage, fields = {}) => _write('error', context, stage, fields, fileKey),
        debug: (stage, fields = {}) => _write('debug', context, stage, fields, fileKey),

        /**
         * Log the full prompt sent to the LLM.
         * Dev only — omitted in production to protect user data.
         */


        prompt: (label, promptText) => {
            if (IS_PROD) return
            _write('prompt', context, label, { prompt: promptText }, fileKey)
        },

        /**
        * Log the raw LLM response.
        * Dev only — omitted in production to protect user data.
        */
        llm: (label, response) => {
            if (IS_PROD) return
            const safe = typeof response === 'string'
                ? response
                : JSON.stringify(response, null, 2)
            _write('llm', context, label, { response: safe }, fileKey)
        },
    }
}

/**
 * Create a job-scoped logger that automatically binds jobId, userId, periodKey
 * and writes to backend/logs/report-<jobId>.log in development.
 *
 * @param {import('bullmq').Job} job
 */

export function createJobLogger(job) {
    const fileKey = IS_PROD ? null : `report-${job.id}`
    const base = createLogger('report-worker', fileKey)

    const bind = (fn) => (stage, fields = {}) =>
        fn(stage, {
            jobId: String(job.id),
            userId: String(job.data.userId),
            period: job.data.periodKey,
            ...fields,
        })

    return {
        info: bind(base.info),
        warn: bind(base.warn),
        error: bind(base.error),
        debug: bind(base.debug),
        prompt: (label, text) => base.prompt(label, text),
        llm: (label, response) => base.llm(label, response),
    }
}


export function createAIJobLogger(job) {
    const fileKey = IS_PROD ? null : `ai-${job.id}`
    const base = createLogger('ai-worker', fileKey)

    const bind = (fn) => (stage, fields = {}) =>
        fn(stage, {
            jobId: String(job.id),
            noteId: String(job.data.noteId),
            ...fields,
        })

    return {
        info: bind(base.info),
        warn: bind(base.warn),
        error: bind(base.error),
        debug: bind(base.debug),
        prompt: (label, text) => base.prompt(label, text),
        llm: (label, response) => base.llm(label, response),
    }
}

export const aiWorkerLogger = createLogger('ai-worker')

/**
 * Module-level logger for events outside of a job context
 * (worker startup, shutdown, uncaught errors).
 */
export const workerLogger = createLogger('report-worker')
