# Security

Please report security issues privately rather than opening a public issue.

Coverage artifacts and source maps can contain source code, local paths, and route names. Covra writes them locally by default and does not upload reports. Users should avoid publishing `.covra/` raw artifacts unless they have reviewed them.

## Sensitive Artifacts

Treat these paths as potentially sensitive:

- `.covra/raw`
- `coverage/covra/index.html`
- `coverage/covra/coverage-final.json`
- `coverage/covra/covra-meta.json`
- generated source maps under `.next`

These files can expose implementation details even when the application source repository is private. Prefer uploading `lcov.info` or summary JSON to trusted CI systems and avoid publishing raw artifacts publicly.

## Network Behavior

Covra itself does not upload coverage. The project release gate includes a networked smoke test that sparse-clones `vercel/next.js` into a temporary directory. That test is for Covra development and is not part of normal user runtime behavior.

## Coverage Mode

`withCovra()` only enables source maps when `COVRA=1`, `COVRA_COVERAGE=1`, or `E2E_COVERAGE=1` is set. Do not enable coverage-mode source maps for normal production deployments unless you have explicitly reviewed the exposure.

## Supported Versions

Only the latest released version is supported while Covra is pre-1.0.
