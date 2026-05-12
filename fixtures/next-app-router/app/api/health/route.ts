import { NextResponse } from 'next/server'
import { serverGreeting } from '../../../src/serverGreeting'

export async function GET() {
  return NextResponse.json({
    ok: true,
    greeting: serverGreeting('API'),
  })
}
