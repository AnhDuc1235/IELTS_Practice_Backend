export function dateTimeFormat(query: any): { from: Date; to: Date } {
    const from = new Date(query.from)
    const to = new Date(query.to)

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        throw new Error(`Invalid date range: from="${query.from}", to="${query.to}"`)
    }

    to.setHours(23, 59, 59, 999)
    from.setHours(0, 0, 0, 0)
    return { from, to }
}