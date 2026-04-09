import { HTTP_STATUS_CODES } from "./constants";

/**
 * Standardized error response for API routes
 */
export function apiErrorResponse<T>(
  error: unknown,
  context: string,
  defaultMessage: string,
  statusCode: number = HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
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
  fn: (c: any) => Promise<T>
) {
  return async (c: any) => {
    try {
      return await fn(c);
    } catch (error) {
      // This will be customized per route since error messages vary
      throw error;
    }
  };
}