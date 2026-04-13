/**
 * Standardized error response for API routes
 */
export function apiErrorResponse(
  error: unknown,
  context: string,
  defaultMessage: string
) {
  console.error(`[${context}] Error:`, error);

  const errorMessage = error instanceof Error ? error.message : String(error);

  // Check for common "not found" patterns
  if (errorMessage.includes("No files found") ||
      errorMessage.includes("does not exist") ||
      errorMessage.includes("not found")) {
    return {
      error: `${defaultMessage} - not found`,
      details: errorMessage
    };
  }

  return {
    error: defaultMessage,
    details: errorMessage
  };
}

/**
 * Wrapper for async route handlers with standardized error handling
 */
export function asyncHandler<T>(
  fn: (c: unknown) => Promise<T>
) {
  return async (c: unknown) => fn(c);
}