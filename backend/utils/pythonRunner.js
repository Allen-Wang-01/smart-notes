/**
 * Runs the python analytics pipeline as a child process
 * 
 * Protocol
 * --------
 * - Input: JSON written to Python's stdin
 * - Output: JSON read from Python's stdout
 * - Python logs / warnings come back on stderr and are forwarded
 *  to logger as warnings - they never corrupt the stdout JSON.
 * 
 * Error handling
 * --------------
 * - Non-zero exit code -> throws with exit code + stderr excerpt
 * - Timeout -> kills the processs
 * - Invalid JSON output -> throws with raw stdout excerpt
 * - Python-level error -> python returns {error: '...', we throw}
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// Resolve path to analytics/main.py relative to this file.
const ANALYTICS_DIR = path.resolve(__dirname, '../../analytics')
const TIMEOUT_MS = 60_000 // 60 s — generous for large note sets
const pythonPath = path.join(ANALYTICS_DIR, '.venv', 'bin', 'python')

/**
 * Run the python report pipeline
 * 
 * @param {{
 *  notes: object[],
 *  period: string,
 *  startDate: string, // ISO date 'YYYY-MM-DD'
 *  endDate: string, // ISO date 'YYYY-MM-DD'
 *  previousReport: object | null,
 * }} payload
 *  @param log
 *  @returns object, The full report JSON from build_report()
 */

export function runPythonPipeline(payload, log) {
    return new Promise((resolve, reject) => {
        const py = spawn(pythonPath, ['-m', 'main'], {
            cwd: ANALYTICS_DIR,
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        let stdout = ''
        let stderr = ''

        py.stdout.on('data', (chunk) => { stdout += chunk })
        py.stderr.on('data', (chunk) => { stderr += chunk })

        // Hard timeout - kill the process if it hangs
        const timer = setTimeout(() => {
            py.kill('SIGTERM')
            reject(new Error(`Python pipeline timed out after ${TIMEOUT_MS} ms`))
        }, TIMEOUT_MS)

        py.on('close', (exitCode) => {
            clearTimeout(timer)

            // Forward Python stderr (validator warnings etc.) as structured warnings
            // This keeps Python's internal logs visible without polluting our JSON stream.
            if (stderr.trim()) {
                log.warn('python_stderr', { stderr: stderr.trim().slice(0, 2000) })
            }

            if (exitCode !== 0) {
                return reject(new Error(
                    `Python exited with code ${exitCode}. ` +
                    `stderr: ${stderr.trim().slice(0, 500)}`
                ))
            }

            // Parse stdout as JSON
            let report
            try {
                report = JSON.parse(stdout)
            } catch (e) {
                return reject(new Error(
                    `Failed to parse Python output as JSON: ${e.message}. ` +
                    `stdout: ${stdout.slice(0, 300)}`
                ))
            }

            // Python signals handled errors via {error: '...}
            if (report.error) {
                return reject(new Error(`Python pipeline error: ${report.error}`))
            }

            resolve(report)
        })

        py.on('error', (err) => {
            clearTimeout(timer)
            reject(new Error(`Failed to spawn Python process: ${err.message}`))
        })

        // Send payload and close stdin to signal EOF to Python
        try {
            py.stdin.write(JSON.stringify(payload), 'utf8')
            py.stdin.end()
        } catch (err) {
            clearTimeout(timer)
            reject(new Error(`Failed to write to Python stdin: ${err.message}`))
        }
    })
}

