// Format period key to human-readable date range
// "2026-W13" -> "2026-03-23 ~ 2026-03-29"
// "2026-M03" -> "2026-03-01 ~ 2026-03-31"
export const formatPeriodLabel = (periodKey: string): string => {
    if (!periodKey) return ""

    // Weekly: "2026-W13"
    const weekMatch = periodKey.match(/^(\d{4})-W(\d{2})$/)
    if (weekMatch) {
        const year = parseInt(weekMatch[1])
        const week = parseInt(weekMatch[2])

        // ISO week date: find the Monday of that week
        // Jan 4th is always in week 1 per ISO 8601
        const jan4 = new Date(year, 0, 4)
        const jan4DayOfWeek = jan4.getDay() || 7 // convert Sunday(0) to 7
        const monday = new Date(jan4)
        monday.setDate(jan4.getDate() - (jan4DayOfWeek - 1) + (week - 1) * 7)

        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        const fmt = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

        return `${fmt(monday)} ~ ${fmt(sunday)}`
    }

    // Monthly: "2026-M03"
    const monthMatch = periodKey.match(/^(\d{4})-M(\d{2})$/)
    if (monthMatch) {
        const year = parseInt(monthMatch[1])
        const month = parseInt(monthMatch[2])
        const lastDay = new Date(year, month, 0).getDate()
        const mm = String(month).padStart(2, '0')
        return `${year}-${mm}-01 ~ ${year}-${mm}-${lastDay}`
    }

    return periodKey
}