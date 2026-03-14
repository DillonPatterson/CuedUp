export function formatTimestamp(value: string) {
  return new Date(value).toLocaleString();
}

export function toArray<T>(value: T | T[]) {
  return Array.isArray(value) ? value : [value];
}
