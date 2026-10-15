// Explicit flags only: unrelated query values must not activate profiling.
export function diagnosticsOptions(search) {
  const params = new URLSearchParams(search);
  const debug = params.has('debug');
  return { debug, profiling: debug || params.has('gpu') || params.has('capture') };
}
