/**
 * Manual test script: call generateReportText() with a fake snapshot and
 * print the result, so you can confirm the report LLM call succeeds and
 * a matching row lands in llm_traces (see scripts/checkTraces.ts).
 *
 * Makes one real OpenAI call — this is intentional.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/testReportTrace.ts
 *
 * Requires in .env: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config'
import { generateReportText } from '../utils/generateReport.js'

const FAKE_SNAPSHOT = `
This week: 5 notes, 3 active days.
Top topics: system design, interview prep.
Mood trend: steady, slightly more confident than last week.
`.trim()

async function run(): Promise<void> {
    const result = await generateReportText(FAKE_SNAPSHOT, {
        userId: 'test-user',
        recordId: 'test-report',
    })

    console.log('paragraphs:')
    for (const paragraph of result.paragraphs) {
        console.log(`  - ${paragraph}`)
    }

    process.exit(0)
}

run().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
