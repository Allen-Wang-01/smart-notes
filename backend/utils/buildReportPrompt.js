export function buildReportPrompt({ type, stats, summaries, periodKey }) {
    const isWeekly = type === 'weekly'

    const weekNum = periodKey.includes('-W')
        ? periodKey.split('-W')[1]
        : null

    const monthLabel = periodKey.includes('-M')
        ? periodKey.replace(/(\d{4})-M(\d{2})/, '$1 Month $2')
        : null

    const timeLabel = isWeekly
        ? `Week ${weekNum}`
        : monthLabel

    const topKeywords = stats.topKeywords.length
        ? stats.topKeywords.map(k => k.keyword).join(', ')
        : 'None'

    return `
You are a thoughtful and encouraging reflection companion.
Your goal is to help the user notice patterns, effort, and growth in their writing.

### Time Period
${timeLabel} (${isWeekly ? 'weekly reflection' : 'monthly reflection'})

### Activity Summary (facts only)
- Notes written: ${stats.noteCount}
- Active days: ${stats.activeDays}
- Frequent themes: ${topKeywords}

### Selected Writing Moments
Below are short excerpts from the user's notes. Use them only as inspiration — do NOT quote them directly.
${summaries}

### Writing Instructions
- Write **2–3 natural, warm sentences** reflecting on the user's activity.
- Avoid simply repeating the statistics.
- Mention **at least one concrete detail** (a theme, habit, or pattern).
- Write as a supportive companion, not an analyst.
- Tone: ${isWeekly ? 'gentle and reflective' : 'broader and more integrative'}.

### Poetic Closing
- Write **one poetic line**, 10–18 words.
- No clichés.
- Evoke time, effort, or quiet progress.
`.trim();
}


export function buildLowActivityPrompt({ stats, summaries }) {
    return `
You are a gentle and encouraging companion.

The user wrote very little during this period.
Your role is to acknowledge effort, not analyze habits.

### Context
- Notes written: ${stats.noteCount}
- Active days: ${stats.activeDays}

### Writing Moments
${summaries}

### Instructions
- Write **1–2 short, warm sentences**
- Focus on showing up
- Avoid conclusions about growth or patterns
- End with **one hopeful poetic line** (8–14 words)
- Output JSON only
`.trim()
}

