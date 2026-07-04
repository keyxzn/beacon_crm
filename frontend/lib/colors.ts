const PALETTE = [
  "#00E5FF", // signal
  "#8B5CF6", // ai-1
  "#FF5CAA", // ai-2
  "#22D3EE", // ai-3
  "#39FF8E", // success
  "#FFB23D", // warning
  "#FF8A4C", // orange
];

/** Warna avatar yang konsisten buat nama yang sama, dihitung dari hash sederhana. */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}