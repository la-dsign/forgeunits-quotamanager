import { useState, useEffect } from 'react'

/**
 * Debounce hook that delays updating a value until after a specified delay
 * Useful for search inputs to avoid excessive API calls
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        // Set up the timeout
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        // Cleanup function - cancel the timeout if value changes before delay
        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}
