// simple stable cursor: base64 of `${sortValue}|${address}`
export function encodeCursor(sortVal: number, address: string) {
  return Buffer.from(`${sortVal}|${address}`).toString("base64url");
}
export function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const [v, addr] = Buffer.from(cursor, "base64url").toString().split("|");
    return { sortVal: Number(v), addr };
  } catch {
    return null;
  }
}
