/**
 * Calls the LLM to generate the final human-readable report from a snapshot.
 * 
 * Retry strategy
 * --------------
 * Retries up to MAX_RETRIES times with exponential backoff for transient
 * errors (network issues, 429, 503). Non-retryable errors(400, 401,403)
 * surface immediately
 * 
 * If all retries fail, throws so BullMQ can retry the whole job.
 */

import { z } from "zod"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { createLogger } from "./logger.js"

const log = createLogger('report-ai')
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1_000 // 1s -> 2s -> 4s

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403])

const openai = new OpenAI

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(err) {
    if (err?.status && NON_RETRYABLE_STATUSES.has(err.status)) return false
    return true
}

/**
 * Call the LLM to generate a structured report from a snapshot prompt.
 * @param {string} prompt - the snapshot string from build_snapshot()
 * @returns {Promise<{summary:string[], poeticLine: string}>}
 */

export async function generateReportText(prompt) {

    const ReportOutputSchema = z.object({
        paragraphs: z.array(z.string()).min(1).max(5),
    });

    // Log the full prompt in development, inspect exactly what was sent to the LLM
    log.prompt('snapshot_sent_to_llm', prompt)

    let lastError
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            log.info('llm_attempt', { attempt, maxRetries: MAX_RETRIES })

            const response = await openai.responses.parse({
                model: "gpt-5-nano",
                input: [
                    {
                        role: "system",
                        content:
                            "You are a thoughtful growth companion. Always respond in the requested JSON format."
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                text: {
                    format: zodTextFormat(ReportOutputSchema, "report")
                },
                store: false,
            })

            const parsed = response.output_parsed

            if (!parsed || !Array.isArray(parsed.summary) || !parsed.poeticLine) {
                throw new Error('LLM returned unexpected output shape')
            }
            // log the full LLM response in development for easy inspection
            log.llm('llm_response_received', parsed)
            log.info('llm_succeeded', { attempt })
            return parsed
        } catch (err) {
            lastError = err
            log.warn('llm_attempt_failed', {
                attempt,
                error: err.message,
                status: err?.status ?? null,
            })

            if (!isRetryable(err)) {
                throw new Error(
                    `LLM call failed with non-retryable error (status ${err?.status}) : ${err.message}`
                )
            }

            if (attempt === MAX_RETRIES) break

            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
            log.info('llm_retry_wait', { delayMs: delay, nextAttempt: attempt + 1 })
            await sleep(delay)
        }
    }

    throw new Error(
        `LLM call failed after ${MAX_RETRIES} attempts.` +
        `Last error: ${lastError?.message ?? String(lastError)}`
    )
}