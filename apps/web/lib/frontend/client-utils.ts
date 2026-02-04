/**
 * Client-side utility functions for browser APIs
 */

/**
 * Safely get an item from localStorage
 * Returns null if localStorage is not available or item doesn't exist
 */
export function getLocalStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.warn("Failed to get item from localStorage:", error)
    return null
  }
}

/**
 * Safely set an item in localStorage
 * Returns true if successful, false otherwise
 */
export function setLocalStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.warn("Failed to set item in localStorage:", error)
    return false
  }
}

/**
 * Safely remove an item from localStorage
 * Returns true if successful, false otherwise
 */
export function removeLocalStorage(key: string): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn("Failed to remove item from localStorage:", error)
    return false
  }
}

/**
 * Get a parsed JSON object from localStorage
 * Returns null if parsing fails or item doesn't exist
 */
export function getLocalStorageJSON<T>(key: string): T | null {
  const item = getLocalStorage(key)
  if (!item) return null

  try {
    return JSON.parse(item) as T
  } catch (error) {
    console.warn("Failed to parse JSON from localStorage:", error)
    return null
  }
}

/**
 * Set a JSON object in localStorage
 * Returns true if successful, false otherwise
 */
export function setLocalStorageJSON<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value)
    return setLocalStorage(key, serialized)
  } catch (error) {
    console.warn("Failed to serialize JSON for localStorage:", error)
    return false
  }
}

/**
 * Check if localStorage is available
 */
export function isLocalStorageAvailable(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    const test = "__localStorage_test__"
    localStorage.setItem(test, "test")
    localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

/**
 * Clear all items from localStorage
 * Returns true if successful, false otherwise
 */
export function clearLocalStorage(): boolean {
  if (typeof window === "undefined") {
    return false
  }

  try {
    localStorage.clear()
    return true
  } catch (error) {
    console.warn("Failed to clear localStorage:", error)
    return false
  }
}
