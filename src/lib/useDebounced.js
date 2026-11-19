import { useEffect, useState } from 'react'

// The value, but only after it has stopped changing for `delay` ms.
// Used for search boxes that query the API as you type.
export default function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
