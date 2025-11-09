import type { Token } from "../types";

export function diffToken(prev: Token, next: Token) {
  const changed: Partial<Record<keyof Token, { from: any; to: any }>> = {};
  (Object.keys(next) as (keyof Token)[]).forEach(k => {
    const a = (prev as any)[k];
    const b = (next as any)[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) changed[k] = { from: a, to: b };
  });
  return changed;
}
