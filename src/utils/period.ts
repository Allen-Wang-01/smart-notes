// --- Constants ---
const MS_PER_DAY = 86400000;

// --- Helpers ---

/** Normalize a date to midnight to avoid timezone issues */
function normalizeToMidnight(date: Date): Date {
    // Create a copy of the input date
    const d = new Date(date)
    // Normalize time to midnight to avoid timezone-related issues
    d.setHours(0, 0, 0, 0)
    return d
}


/** Calculate ISO week number (Monday as first day) */
function getIsoWeekNumber(date: Date): number {
    const d = normalizeToMidnight(new Date(date))
    const thursday = new Date(d) //deep copy date, avoid to modify original date
    thursday.setDate(d.getDate() + 4 - (d.getDay() || 7))

    const yearStart = new Date(thursday.getFullYear(), 0, 1)
    const yearStartThursday = new Date(yearStart)
    yearStartThursday.setDate(yearStart.getDate() + 4 - (yearStart.getDay() || 7))
    return Math.floor((thursday.getTime() - yearStartThursday.getTime()) / MS_PER_DAY / 7) + 1
}

// --- Main functions ---

/** Generate a weekly period key like "2025-W07" */
export function getWeeklyKey(date: Date = new Date()): string {
    const d = normalizeToMidnight(date)
    const weekNo = getIsoWeekNumber(d)
    const year = d.getFullYear()
    return `${year}-W${weekNo.toString().padStart(2, '0')}`
}


/** Generate a monthly period key like "2025-M02" */
export function getMonthlyKey(date: Date = new Date()): string {
    const d = new Date(date)
    const y = d.getFullYear()
    const m = (d.getMonth() + 1).toString().padStart(2, '0')
    return `${y}-M${m}`
}

/** Get previous period key for "YYYY-Www" or "YYYY-Mmm" */
export function getPreviousPeriodKey(key: string): string {
    if (key.includes('-W')) {
        const match = key.match(/(\d{4})-W(\d{2})/)
        if (!match) throw new Error('Invalid week key')
        const [, year, week] = match
        const thursday = new Date(parseInt(year), 0, 4 + (parseInt(week) - 1) * 7)
        thursday.setDate(thursday.getDate() - 7)
        return getWeeklyKey(thursday)
    }

    if (key.includes('-M')) {
        const match = key.match(/(\d{4})-M(\d{2})/)
        if (!match) throw new Error('Invalid month key')
        const [, year, month] = match
        const d = new Date(parseInt(year), parseInt(month) - 2, 1) // month is 1-based
        return getMonthlyKey(d)
    }
    throw new Error('Invalid period key')
}

/** Get next period key for "YYYY-WW" or "YYYY-MM" */
export function getNextPeriodKey(key: string): string {
    if (key.includes('-W')) {
        const match = key.match(/(\d{4})-W(\d{2})/)
        if (!match) throw new Error('Invalid week key')
        const [, year, week] = match
        const thursday = new Date(
            parseInt(year),
            0,
            4 + (parseInt(week) - 1) * 7
        )
        thursday.setDate(thursday.getDate() + 7)
        return getWeeklyKey(thursday)
    }

    if (key.includes('-M')) {
        const match = key.match(/(\d{4})-M(\d{2})/)
        if (!match) throw new Error('Invalid month key')
        const [, year, month] = match

        const d = new Date(parseInt(year), parseInt(month), 1)
        return getMonthlyKey(d)
    }
    throw new Error('Invalid period key')
}