import type { NextApiRequest, NextApiResponse } from 'next'
import { pagesGreeting } from '../../src/pagesGreeting'

export default function handler(_request: NextApiRequest, response: NextApiResponse) {
  response.status(200).json({
    ok: true,
    greeting: pagesGreeting('API'),
  })
}
