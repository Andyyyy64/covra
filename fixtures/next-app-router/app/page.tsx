import { ClientCounter } from '../src/ClientCounter'
import { serverGreeting } from '../src/serverGreeting'

export default function HomePage() {
  const greeting = serverGreeting('Covra')

  return (
    <main>
      <h1>Covra fixture</h1>
      <p data-testid="server-greeting">{greeting}</p>
      <ClientCounter />
    </main>
  )
}
