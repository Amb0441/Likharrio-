/**
 * Wraps a promise with a timeout.
 * Rejects with a SlowNetworkError after `ms` milliseconds if the promise hasn't resolved.
 */
export class SlowNetworkError extends Error {
  constructor() {
    super('Request timed out. Please check your connection and try again.');
    this.name = 'SlowNetworkError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms = 15000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new SlowNetworkError()), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}
