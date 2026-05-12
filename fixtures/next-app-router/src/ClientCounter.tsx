'use client'

import { useState } from 'react'

export function ClientCounter() {
  const [count, setCount] = useState(0)
  const label = count === 0 ? 'idle' : 'clicked'

  return (
    <section>
      <p data-testid="client-label">{label}</p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Count {count}
      </button>
    </section>
  )
}
