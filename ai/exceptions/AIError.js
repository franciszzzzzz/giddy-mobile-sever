import HandleError from "../../utils/HandleError.js";
import { AI_ERRORS } from "../constants/errors.js";

/**
 * Custom error class for AI-related operations.
 * Extends the application's standard HandleError so it
 * integrates with the global error middleware.
 */
class AIError extends HandleError {
  /**
   * @param {string} code Internal AI error code
   * @param {string} message Human-readable error message
   * @param {number} statusCode HTTP status code
   * @param {Object|null} details Additional debugging information
   */
  constructor(
    code = AI_ERRORS.UNKNOWN,
    message = "An unexpected AI error occurred.",
    statusCode = 500,
    details = null,
  ) {
    super(message, statusCode);

    this.name = "AIError";

    this.code = code;

    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,

      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export default AIError;
