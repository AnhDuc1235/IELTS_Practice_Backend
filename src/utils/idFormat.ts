// All test-content ids (tests, parts, groups, questions, attempts) are BigInt in the schema,
// but route params / query strings arrive as strings.
export function idFormat(value: unknown, name: string = "id"): bigint {
    if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
        throw new Error(`Invalid ${name}`)
    }
    return BigInt(value)
}
