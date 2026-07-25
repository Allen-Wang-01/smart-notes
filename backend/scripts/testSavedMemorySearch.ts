/**
 * Manual test script: run semantic search across saved_memories and
 * print results so you can inspect recall quality and similarity scores.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/testSavedMemorySearch.ts
 *
 * Requires in .env: MONGO_URI, DEMO_USER_EMAIL, OPENAI_API_KEY,
 *                   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { searchSavedMemories } from '../lib/savedMemory.js'

const MONGO_URI = process.env['MONGO_URI']
const SEED_EMAIL = process.env['DEMO_USER_EMAIL']

const TEST_QUERIES = [
    { label: '日語學習全貌', query: '我的日語學習情況和進度' },
    { label: '敬語專項',     query: '敬語 尊敬語 謙讓語' },
    { label: '項目架構',     query: '項目架構和技術選型決策' },
]

const DIVIDER = '─'.repeat(64)

async function run(): Promise<void> {
    if (!MONGO_URI || !SEED_EMAIL) {
        console.error('MONGO_URI and DEMO_USER_EMAIL must be set in .env')
        process.exit(1)
    }

    await mongoose.connect(MONGO_URI)

    const user = await User.findOne({ email: SEED_EMAIL })
    if (!user) {
        console.error(`No user found with email: ${SEED_EMAIL}`)
        process.exit(1)
    }

    const userId = String(user._id)
    console.log(`User: ${SEED_EMAIL}  (id: ${userId})\n`)

    for (const { label, query } of TEST_QUERIES) {
        console.log(DIVIDER)
        console.log(`[${label}]  query: "${query}"`)
        console.log(DIVIDER)

        const result = await searchSavedMemories({ userId, query })

        if (result.raw.length === 0) {
            console.log('  (no results above threshold)\n')
            continue
        }

        console.log(`  ${result.raw.length} hit(s) across ${result.topics.length} topic(s)\n`)

        for (const group of result.topics) {
            console.log(`  ▸ topic: "${group.topic}"`)
            for (const entry of group.entries) {
                const preview = entry.content.length > 90
                    ? entry.content.slice(0, 90) + '…'
                    : entry.content
                console.log(`      similarity : ${entry.similarity.toFixed(4)}`)
                console.log(`      content    : ${preview}`)
                console.log(`      tags       : [${entry.tags.join(', ')}]`)
                console.log()
            }
        }
    }

    process.exit(0)
}

run().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
