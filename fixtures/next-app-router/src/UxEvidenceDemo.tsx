'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'

export function UxEvidenceDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [showChecklist, setShowChecklist] = useState(false)
  const [apiResult, setApiResult] = useState('idle')

  async function loadDemoApi() {
    setApiResult('loading')
    const response = await fetch('/api/ux-evidence')
    const payload = await response.json() as { ok: boolean }
    setApiResult(payload.ok ? 'ok' : 'failed')
  }

  function submitBillingForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  return (
    <main>
      <h1>UX evidence fixture</h1>

      <section aria-label="Modal example">
        <button type="button" onClick={() => setModalOpen(true)}>
          Open billing modal
        </button>
        {modalOpen ? (
          <div role="dialog" aria-modal="true" aria-label="Billing modal">
            Billing modal content
          </div>
        ) : null}
      </section>

      <form aria-label="Billing form" onSubmit={submitBillingForm}>
        <label>
          Email
          <input aria-invalid={submitted ? 'true' : undefined} name="email" />
        </label>
        <button type="submit">Submit billing form</button>
        {submitted ? <p role="alert">Email is required</p> : null}
      </form>

      <section aria-label="Checklist example">
        <button type="button" onClick={() => setShowChecklist(true)}>
          Show review checklist
        </button>
        {showChecklist ? (
          <section data-testid="review-checklist" aria-label="Review checklist">
            <ul role="list">
              {Array.from({ length: 100 }, (_, index) => (
                <li role="listitem" key={index}>
                  Review item {index + 1}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>

      <section aria-label="API example">
        <button type="button" onClick={loadDemoApi}>
          Load demo API
        </button>
        <p data-testid="api-result">{apiResult}</p>
      </section>
    </main>
  )
}
