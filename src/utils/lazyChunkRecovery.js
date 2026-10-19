const LAZY_CHUNK_ERROR_PATTERNS = [
  /dynamically imported module/i,
  /failed to fetch.*module/i,
  /loading chunk [\d-]+ failed/i,
  /chunkloaderror/i,
  /importing a module script failed/i,
];

export function isLazyChunkLoadError(error) {
  const message = error instanceof Error ? error.message : String(error || '');
  return LAZY_CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
