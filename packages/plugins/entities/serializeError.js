export function serializeError(error) {
  if (!error || typeof error !== 'object') return { message: String(error) }

  return {
    name: error.name || 'Error',
    message: error.message,
    stack: error.stack,
    ...(error.code && { code: error.code }),
    ...(error.cause && { cause: serializeError(error.cause) }),
    ...(error.fileName && { fileName: error.fileName }),
    ...(error.lineNumber && { lineNumber: error.lineNumber }),
    ...(error.columnNumber && { columnNumber: error.columnNumber }),
  }
}
