export function restoreUUID(hexString: string): string {
    if (hexString.length !== 32) return hexString;
    return `${hexString.slice(0, 8)}-${hexString.slice(8, 12)}-${hexString.slice(12, 16)}-${hexString.slice(16, 20)}-${hexString.slice(20)}`;
}