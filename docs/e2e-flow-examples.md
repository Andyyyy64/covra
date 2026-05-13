# E2E Flow Examples

This page explains Covra's E2E flow model with a concrete fixture in this repository.

The example app lives in:

- `fixtures/next-app-router/app/ux-evidence/page.tsx`
- `fixtures/next-app-router/src/UxEvidenceDemo.tsx`
- `fixtures/next-app-router/app/api/ux-evidence/route.ts`
- `fixtures/next-app-router/e2e/ux-evidence.spec.ts`

## Example Code

The page has four user-visible behaviors:

```tsx
// fixtures/next-app-router/src/UxEvidenceDemo.tsx
<button type="button" onClick={() => setModalOpen(true)}>
  Open billing modal
</button>

{modalOpen ? (
  <div role="dialog" aria-modal="true" aria-label="Billing modal">
    Billing modal content
  </div>
) : null}

<form aria-label="Billing form" onSubmit={submitBillingForm}>
  <label>
    Email
    <input aria-invalid={submitted ? 'true' : undefined} name="email" />
  </label>
  <button type="submit">Submit billing form</button>
  {submitted ? <p role="alert">Email is required</p> : null}
</form>

<button type="button" onClick={() => setShowChecklist(true)}>
  Show review checklist
</button>

{showChecklist ? (
  <section data-testid="review-checklist" aria-label="Review checklist">
    <ul role="list">
      {Array.from({ length: 100 }, (_, index) => (
        <li role="listitem" key={index}>Review item {index + 1}</li>
      ))}
    </ul>
  </section>
) : null}

<button type="button" onClick={loadDemoApi}>
  Load demo API
</button>
```

The Playwright test exercises those behaviors:

```ts
// fixtures/next-app-router/e2e/ux-evidence.spec.ts
await page.goto('/ux-evidence')
await page.getByRole('button', { name: 'Open billing modal' }).click()
await expect(page.getByRole('dialog', { name: 'Billing modal' })).toBeVisible()

await page.getByRole('button', { name: 'Submit billing form' }).click()
await expect(page.getByText('Email is required')).toBeVisible()

await page.getByRole('button', { name: 'Show review checklist' }).click()
await expect(page.getByTestId('review-checklist')).toBeVisible()
await expect(page.getByRole('listitem')).toHaveCount(100)

await page.getByRole('button', { name: 'Load demo API' }).click()
await expect(page.getByTestId('api-result')).toHaveText('ok')
```

## What Covra Can Say

Covra can say that `/ux-evidence` was exercised by E2E flow evidence:

- the page was navigated to
- buttons were clicked
- a dialog became visible
- an invalid form field and alert became visible
- a collection-like surface with 100 list items became visible
- `GET /api/ux-evidence 200` happened during the route flow

In `covra routes`, this appears as counts:

```text
Route              Kind       E2E flow  UX states  UI events  API calls
/ux-evidence       app-page   covered   ...        ...        1
/api/ux-evidence   app-route  covered   ...        0          1
```

In `route-coverage.json`, the same route includes concrete evidence strings such as:

```json
{
  "route": "/ux-evidence",
  "uiEvents": [
    "click: button \"Open billing modal\"",
    "dialog.open: dialog \"Billing modal\"",
    "form.validation.error: textbox \"Email\"",
    "collection.items: section \"Review checklist\" (100)"
  ],
  "apiCalls": [
    "GET /api/ux-evidence 200"
  ]
}
```

The exact event list may include additional browser-observed evidence, but it should stay factual: event type, accessible target, count, method, URL, and status.

## What Covra Must Not Claim

Covra should not turn those facts into business semantics by itself.

It should not claim:

- `collection.limit.100`
- `billing.create.success`
- `action.open.modal.open`
- `api.ux-evidence.load.success`

Those labels look useful, but they smuggle product meaning into a coverage report. A DOM with 100 list items does not prove the product has a 100-item limit. A 200 response does not prove a business operation succeeded unless the test asserts that product outcome.

## Practical Reading

Use the dashboard like this:

- `E2E flow: covered` means the route had at least one observed user-flow signal.
- `UI events` shows what the user did or what became visible.
- `API calls` shows browser-observed API traffic.
- `Lines` and `Branches` remain source-level coverage details.

If only the critical path is tested, non-critical routes should remain `missing` or show no UI/API evidence. If a modal, validation path, or list state matters, the Playwright test must actually exercise it so Covra can observe it.
