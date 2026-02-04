import { Transform } from "class-transformer";

/**
 * Custom transformer decorator for handling JSON fields in FormData.
 * When FormData contains stringified JSON objects, this decorator will
 * automatically parse them back to their original object structure.
 */
export function ParseJsonField() {
  return Transform(({ value }) => {
    // If the value is already an object, return as-is
    if (typeof value === "object" && value !== null) {
      return value;
    }

    // If the value is a string, try to parse it as JSON
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        // If parsing fails, return the original string value
        // This handles cases where the field is just a regular string
        return value;
      }
    }

    // For any other type, return as-is
    return value;
  });
}
