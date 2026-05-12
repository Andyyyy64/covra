import { useState } from 'react'
import { pagesGreeting } from '../src/pagesGreeting'

type LegacyPageProps = {
  greeting: string
}

export default function LegacyPage({ greeting }: LegacyPageProps) {
  const [clicked, setClicked] = useState(false)

  return (
    <main>
      <h1>Pages Router fixture</h1>
      <p data-testid="pages-greeting">{greeting}</p>
      <button type="button" onClick={() => setClicked(true)}>
        {clicked ? 'Legacy clicked' : 'Legacy idle'}
      </button>
    </main>
  )
}

export function getServerSideProps() {
  return {
    props: {
      greeting: pagesGreeting('Covra'),
    },
  }
}
