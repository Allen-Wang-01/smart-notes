/**
 * One-time seed script: inserts test data into saved_memories
 * to verify the table is writable and the embedding pipeline works.
 *
 * Usage:
 *   cd backend
 *   npx tsx scripts/seedSavedMemory.ts
 *
 * Requires in .env: MONGO_URI, TEST_USER_EMAIL, OPENAI_API_KEY,
 *                   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { saveMemory } from '../lib/savedMemory.js'

const MONGO_URI = process.env['MONGO_URI']
const SEED_EMAIL = process.env['DEMO_USER_EMAIL']

interface SeedEntry {
    topic: string
    content: string
    tags: string[]
}

const SEED_MEMORIES: SeedEntry[] = [
    // Topic 1: 日語學習進度 — 3 entries at different learning stages
    {
        topic: '日語學習進度',
        content:
            '掌握了 て形 連接動詞的用法，可以流暢表達動作順序，例如「食べて、飲んで、帰る」。目前弱點是助詞 の・が・は 的語感差異，尤其在複雜句中 の vs が 的選擇還不夠自然，需要刻意練習。',
        tags: ['日語', '語法', 'N4'],
    },
    {
        topic: '日語學習進度',
        content:
            '本週學習敬語（keigo）基本框架：尊敬語（そんけいご）和謙讓語（けんじょうご）的分野已能掌握，尊敬語在日常對話中使用基本無誤。謙讓語在複雜句中仍然容易混淆動詞選型，例如 いらっしゃる vs おいでになる 的細微差別還需要更多輸入。',
        tags: ['日語', '敬語', 'N3', '商務日語'],
    },
    {
        topic: '日語學習進度',
        content:
            'N3 文法整體已覆蓋，剩餘弱點集中兩塊：① ～てしまう 和 ～ておく 的語感差異（前者強調遺憾/完成，後者強調預先準備）在自然語境中仍然混用；② 條件句四選一（～たら / ～ば / ～と / ～なら）的使用場景需要更多例句強化。聽力在自然語速下理解率約 70%，電影對白仍需字幕輔助。',
        tags: ['日語', '文法', 'N3', '聽力'],
    },
    // Topic 1 extras: intentionally different topic strings, same subject area.
    // These exist solely to verify that semantic retrieval does NOT depend on
    // topic string matching — all three should surface for Japanese-learning queries.
    {
        topic: 'Japanese learning',
        content:
            'Finished Chapter 5 of Minna no Nihongo: て-form chaining verbs. Can now form sequences like 食べてから、勉強します. Next chapter covers giving/receiving verbs (あげる/もらう/くれる), which I expect to be tricky because the direction of giving determines the verb choice.',
        tags: ['日語', '教材', 'Minna no Nihongo', 'N4'],
    },
    {
        topic: '日语学习',
        content:
            '完成了 N3 词汇表 A–F 共约 400 个单词的记忆。「遠慮する」「感謝する」「判断する」等サ変動詞已基本掌握。难点是同音异义词，例如「以外」(いがい, except) 和「意外」(いがい, unexpected) 拼写不同但发音相同，在写作中极易混淆，需要专项练习。',
        tags: ['日語', 'N3', '詞彙', '同音異義'],
    },
    {
        topic: 'N3 复习',
        content:
            '模擬試驗結果：語言知識 71/120，聽解 28/60。失分集中三點：① 外來語カタカナ詞彙；② ～に対して vs ～について 的語義區分；③ 長篇聽解對話。下週重點攻克以上三塊，計劃每天加做兩篇長篇聽解練習。',
        tags: ['日語', 'N3', '模擬試驗', '弱點分析'],
    },
    // Topic 2: 項目架構決策 — 2 entries
    {
        topic: '項目架構決策',
        content:
            '選擇 BullMQ + SSE 組合處理 AI 流式輸出，而非 WebSocket。核心原因：SSE 是單向流，在 Fly.io 無狀態部署中不需要 sticky session，橫向擴展更容易；BullMQ 自帶 retry 和 job lock 機制，不需要自己處理斷線重試。WebSocket 適合雙向實時通信，這個場景不需要。',
        tags: ['架構', 'BullMQ', 'SSE', 'Fly.io'],
    },
    {
        topic: '項目架構決策',
        content:
            '認知單元（cognitive_units）的合併閾值定為 0.92 而非更低。測試中 0.85 會把「Node.js 效能優化」和「Node.js 記憶體管理」誤合併，導致上下文資訊損失；0.92 能正確區分同一技術的不同面向，同時仍能合併「Node.js」和「nodejs」這類表面差異的重複項。',
        tags: ['架構', '認知單元', 'pgvector', '閾值調優'],
    },
]

async function run(): Promise<void> {
    if (!MONGO_URI) {
        console.error('MONGO_URI is not set in .env')
        process.exit(1)
    }
    if (!SEED_EMAIL) {
        console.error('DEMO_USER_EMAIL is not set in .env')
        process.exit(1)
    }

    await mongoose.connect(MONGO_URI)

    const user = await User.findOne({ email: SEED_EMAIL })
    if (!user) {
        console.error(`No user found with email: ${SEED_EMAIL}`)
        process.exit(1)
    }

    const userId = String(user._id)
    console.log(`Seeding memories for ${SEED_EMAIL} (user_id: ${userId})`)

    for (const mem of SEED_MEMORIES) {
        const row = await saveMemory({ userId, ...mem })
        console.log(`  Inserted [${mem.topic}] → id: ${row.id}`)
    }

    console.log(`\nDone. ${SEED_MEMORIES.length} entries inserted.`)
    process.exit(0)
}

run().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
})
