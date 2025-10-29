export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Operation timed out'
): Promise<T> {
  if (!ms || ms <= 0) return promise;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      v => {
        if (timer) clearTimeout(timer);
        resolve(v);
      },
      e => {
        if (timer) clearTimeout(timer);
        reject(e);
      }
    );
  });
}
