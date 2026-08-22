/**
 * Manual test script for the llm_traces table: seed fake rows, print the
 * most recent ones, or clean up the seed rows again.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/checkTraces.ts --seed         # insert 3 fake rows (call_site = '_seed_test')
 *   npx tsx scripts/checkTraces.ts                 # print the 10 most recent rows
 *   npx tsx scripts/checkTraces.ts --clear-seed    # delete only the seed rows
 *   npx tsx scripts/checkTraces.ts --price-check   # print computeCost() on fixed inputs; no network calls
 *   npx tsx scripts/checkTraces.ts --last-output   # print call_site + first 400 chars of the latest row's output
 *   npx tsx scripts/checkTraces.ts --summary       # per call_site: calls, total tokens, total cost, avg latency
 *
 * Requires in .env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { db } from '../config/postgres.js'
import { insertTrace, hashInput } from '../lib/trace.js'
import { computeCost } from '../config/modelPricing.js'

const SUPABASE_URL = process.env['SUPABASE_URL']
const SUPABASE_SERVICE_ROLE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const SEED_CALL_SITE = '_seed_test'

async function seed(): Promise<void> {
    const completionInput = { prompt: 'seed completion prompt for checkTraces --seed' }
    const completionOutput = 'seed completion output'

    await insertTrace({
        callSite: SEED_CALL_SITE,
        callType: 'completion',
        model: 'gpt-5-nano',
        promptVersion: 'v1-seed',
        input: completionInput,
        output: completionOutput,
        inputChars: JSON.stringify(completionInput).length,
        inputHash: hashInput(JSON.stringify(completionInput)),
        inputTokens: 120,
        outputTokens: 45,
        totalTokens: 165,
        costUsd: 0.000231,
        latencyMs: 842,
        firstTokenMs: 210,
        status: 'ok',
    })

    const embeddingText = 'seed embedding input for checkTraces --seed'
    await insertTrace({
        callSite: SEED_CALL_SITE,
        callType: 'embedding',
        model: 'text-embedding-3-small',
        inputChars: embeddingText.length,
        inputHash: hashInput(embeddingText),
        inputTokens: 12,
        totalTokens: 12,
        status: 'ok',
    })

    await insertTrace({
        callSite: SEED_CALL_SITE,
        callType: 'completion',
        model: 'gpt-5-nano',
        status: 'error',
        error: 'seed error: simulated failure for checkTraces --seed',
    })

    console.log('Seeded 3 rows with call_site = "_seed_test"')
}

async function listRecent(): Promise<void> {
    const { data, error } = await supabase
        .from('llm_traces')
        .select(
            'call_site, call_type, model, prompt_version, input_tokens, output_tokens, cost_usd, latency_ms, status, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(10)

    if (error) {
        console.error(error)
        process.exit(1)
    }

    if (!data || data.length === 0) {
        console.log('(no rows in llm_traces)')
        return
    }

    console.table(data)
}

interface PriceCheckRow {
    model: string
    inputTokens: number
    cachedTokens: number
    outputTokens: number
}

const PRICE_CHECK_ROWS: PriceCheckRow[] = [
    { model: 'gpt-5-nano', inputTokens: 3412, cachedTokens: 0, outputTokens: 891 },
    { model: 'gpt-5-nano', inputTokens: 3412, cachedTokens: 2048, outputTokens: 891 },
    { model: 'text-embedding-3-small', inputTokens: 284, cachedTokens: 0, outputTokens: 0 },
    { model: 'unknown-model', inputTokens: 1000, cachedTokens: 0, outputTokens: 1000 },
]

function priceCheck(): void {
    const modelWidth = Math.max(
        'model'.length,
        ...PRICE_CHECK_ROWS.map((row) => row.model.length)
    )

    const header =
        'model'.padEnd(modelWidth) +
        '  ' + 'in_tok'.padStart(6) +
        '  ' + 'cached'.padStart(6) +
        '  ' + 'out_tok'.padStart(7) +
        '  ' + 'cost_usd'

    const lines = PRICE_CHECK_ROWS.map((row) => {
        const cost = computeCost({
            model: row.model,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            cachedTokens: row.cachedTokens,
        })
        const costStr = cost === null ? 'null' : cost.toFixed(10)

        return (
            row.model.padEnd(modelWidth) +
            '  ' + String(row.inputTokens).padStart(6) +
            '  ' + String(row.cachedTokens).padStart(6) +
            '  ' + String(row.outputTokens).padStart(7) +
            '  ' + costStr
        )
    })

    console.log([header, ...lines].join('\n'))
}

async function lastOutput(): Promise<void> {
    const { data, error } = await supabase
        .from('llm_traces')
        .select('call_site, output')
        .order('created_at', { ascending: false })
        .limit(1)

    if (error) {
        console.error(error)
        process.exit(1)
    }

    const row = data?.[0]
    if (!row) {
        console.log('(no rows in llm_traces)')
        return
    }

    console.log(`call_site: ${row.call_site}`)
    console.log('output (first 400 chars):')
    console.log(String(row.output ?? '').slice(0, 400))
}

interface SummaryTraceRow {
    call_site: string
    total_tokens: number | null
    cost_usd: number | null
    latency_ms: number | null
}

async function summary(): Promise<void> {
    const { data, error } = await supabase
        .from('llm_traces')
        .select('call_site, total_tokens, cost_usd, latency_ms')
        .limit(10000)

    if (error) {
        console.error(error)
        process.exit(1)
    }

    if (!data || data.length === 0) {
        console.log('(no rows in llm_traces)')
        return
    }

    const groups = new Map<string, { calls: number; totalTokens: number; totalCost: number; latencySum: number; latencyCount: number }>()

    for (const row of data as SummaryTraceRow[]) {
        const group = groups.get(row.call_site) ?? { calls: 0, totalTokens: 0, totalCost: 0, latencySum: 0, latencyCount: 0 }
        group.calls += 1
        group.totalTokens += row.total_tokens ?? 0
        group.totalCost += row.cost_usd ?? 0
        if (row.latency_ms !== null) {
            group.latencySum += row.latency_ms
            group.latencyCount += 1
        }
        groups.set(row.call_site, group)
    }

    const rows = Array.from(groups.entries())
        .map(([callSite, g]) => ({
            callSite,
            calls: g.calls,
            totalTokens: g.totalTokens,
            totalCost: g.totalCost,
            avgLatencyMs: g.latencyCount > 0 ? g.latencySum / g.latencyCount : null,
        }))
        .sort((a, b) => b.totalCost - a.totalCost)

    const callSiteWidth = Math.max('call_site'.length, ...rows.map((r) => r.callSite.length))

    const header =
        'call_site'.padEnd(callSiteWidth) +
        '  ' + 'calls'.padStart(5) +
        '  ' + 'total_tokens'.padStart(12) +
        '  ' + 'total_cost_usd'.padStart(14) +
        '  ' + 'avg_latency_ms'

    const lines = rows.map((r) =>
        r.callSite.padEnd(callSiteWidth) +
        '  ' + String(r.calls).padStart(5) +
        '  ' + String(r.totalTokens).padStart(12) +
        '  ' + r.totalCost.toFixed(6).padStart(14) +
        '  ' + (r.avgLatencyMs !== null ? r.avgLatencyMs.toFixed(1) : 'n/a')
    )

    console.log([header, ...lines].join('\n'))
}

async function clearSeed(): Promise<void> {
    // Hardcoded to the seed marker only — must never delete real traces.
    await db.delete('llm_traces', { eq: { call_site: '_seed_test' } })
    console.log('Deleted rows with call_site = "_seed_test"')
}

async function run(): Promise<void> {
    const mode = process.argv[2]

    if (mode === '--seed') {
        await seed()
    } else if (mode === '--clear-seed') {
        await clearSeed()
    } else if (mode === '--price-check') {
        priceCheck()
    } else if (mode === '--last-output') {
        await lastOutput()
    } else if (mode === '--summary') {
        await summary()
    } else if (!mode) {
        await listRecent()
    } else {
        console.error(`Unknown argument: ${mode}`)
        console.error('Usage: npx tsx scripts/checkTraces.ts [--seed | --clear-seed | --price-check | --last-output | --summary]')
        process.exit(1)
    }

    process.exit(0)
}

run().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
