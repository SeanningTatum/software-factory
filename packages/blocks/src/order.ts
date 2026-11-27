/** Sorts strings by code unit, as `sort()` does, so output does not change with the machine's locale. */
export const byCodeUnit = (a: string, b: string) => Number(a > b) - Number(a < b);
