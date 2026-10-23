/** Runs `call` over `items` in sequential batches so the UI can show progress and stop part-way. */
export async function runBatches<T, R>(
  items: T[],
  size: number,
  call: (batch: T[]) => Promise<R[]>,
  onProgress: (done: number, batchResults: R[]) => void,
  signal: AbortSignal,
) {
  let done = 0;
  for (let i = 0; i < items.length && !signal.aborted; i += size) {
    const batch = items.slice(i, i + size);
    let results: R[] = [];
    try { results = await call(batch); } catch { /* a failed batch counts as done with no results */ }
    done += batch.length;
    onProgress(done, results);
  }
}

export const generic = (email: string) =>
  /^(info|contact|hello|office|admin|support|sales|enquiries|inquiries|mail|team|booking|bookings|reception|appointments)@/i.test(email);
