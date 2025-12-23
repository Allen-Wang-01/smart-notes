/**
 * =============================================================================
 * Period Key Utilities
 * -----------------------------------------------------------------------------
 * Generate standardized period identifiers for weekly & monthly reports.
 *
 * Formats:
 *   Weekly : "2025-W11"   → ISO week number (Monday = week start)
 *   Monthly: "2025-M03"   → Calendar month (01-12)
 *
 * All functions are **pure**, **timezone-aware**, and **deterministic**.
 * =============================================================================
 */

/**
 * Returns the ISO week number (1-53) for a given date.
 * Monday is the first day of the week (ISO 8601).
 *
 * @param {Date} date
 * @returns {number} week number
 */

function getISOWeek(date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)

    //set to nearest thursday (ISO week belongs to the thursday)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))

    //get first thursday of the year
    const yearStart = new Date(d.getFullYear(), 0, 1)
    const firstThursday = new Date(
        yearStart.getFullYear(),
        0,
        1 + ((4 - yearStart.getDay() + 7) % 7)
    );

    //calculate week number
    const weekNum = Math.ceil(((d - firstThursday) / 86400000 + 1) / 7)
    return weekNum
}

/**
 * Get the Monday of the ISO week that contains the given date.
 *
 * @param {Date} date
 * @returns {Date} Monday at 00:00:00 JST
 */

function getMondayOfISOWeek(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = (day === 0 ? -6 : 1 - day) // sunday -> previous monday
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d
}

/**
 * Generate weekly period key: "YYYY-Www"
 * e.g., "2025-W11"
 *
 * @param {Date|string|number} date - Any valid Date input
 * @returns {string} "2025-W11"
 */

export function getWeeklyKey(date = new Date()) {
    const d = new Date(date)
    const year = d.getFullYear()
    const week = getISOWeek(d).toString().padStart(2, '0')
    return `${year}-W${week}`
}

/**
 * Generate monthly period key: "YYYY-MMM"
 * e.g., "2025-M03"
 *
 * @param {Date|string|number} date - Any valid Date input
 * @returns {string} "2025-M03"
 */
export function getMonthlyKey(date = new Date()) {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = (d.getMonth() + 1).toString().padStart(2, '0') // Jan = 01
    return `${year}-M${month}`
}

/**
 * Get start & end dates for a weekly period key.
 *
 * @param {string} periodKey - e.g., "2025-W11"
 * @returns {{ start: Date, end: Date }} Monday 00:00 → Sunday 23:59:59 JST
 */

export function parseWeeklyPeriod(periodKey) {
    const match = periodKey.match(/^(\d{4})-W(\d{2})$/)
    if (!match) throw new Error(`Invalid weekly periodKey: ${periodKey}`)

    const year = parseInt(match[1], 10)
    const week = parseInt(match[2], 0)

    //find the monday of that ISO week
    const jan4 = new Date(year, 0, 4) //Jan 4 is always in week 1
    const monday = getMondayOfISOWeek(jan4)
    monday.setDate(monday.getDate() + (week - 1) * 7)

    const start = new Date(monday)
    const end = new Date(monday)
    end.setDate(end.getDate() + 6)
    end.setHours(23, 59, 59, 999)

    return { start, end }
}

/**
 * Get start & end dates for a monthly period key.
 *
 * @param {string} periodKey - e.g., "2025-M03"
 * @returns {{ start: Date, end: Date }} 1st 00:00 → last day 23:59:59 JST
 */

export function parseMonthlyPeriod(periodKey) {
    const match = periodKey.match(/^(\d{4})-M(\d{2})$/)
    if (!match) throw new Error(`Invalid monthly periodKey: ${periodKey}`);

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JS month is 0-indexed

    const start = new Date(year, month, 1, 0, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of month

    return { start, end };
}

/**
 * Get the period key for the **previous** period.
 *
 * @param {string} currentKey - "2025-W11" or "2025-M03"
 * @returns {string}
 */
export function getPreviousPeriodKey(currentKey) {
    if (currentKey.includes('-W')) {
        const { start } = parseWeeklyPeriod(currentKey);
        start.setDate(start.getDate() - 7);
        return getWeeklyKey(start);
    } else if (currentKey.includes('-M')) {
        const { start } = parseMonthlyPeriod(currentKey);
        start.setMonth(start.getMonth() - 1);
        return getMonthlyKey(start);
    }
    throw new Error(`Invalid periodKey: ${currentKey}`);
}