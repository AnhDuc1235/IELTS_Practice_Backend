// Tất cả ID nội dung thi (test, part, group, question, attempt) là BigInt trong CSDL Prisma,
// nhưng trên route params hoặc query string có thể truyền vào dạng chuỗi hoặc số.
export function idFormat(value: unknown, name: string = "id"): bigint {
    const str = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
    if (!/^[1-9]\d*$/.test(str)) {
        throw new Error(`Invalid ${name}`);
    }
    return BigInt(str);
}

