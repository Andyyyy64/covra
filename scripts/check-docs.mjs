import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fg from 'fast-glob'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const docs = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  ...(await fg('docs/**/*.md', { cwd: root, onlyFiles: true })),
]

const failures = []

for (const relativeFile of docs) {
  const fullPath = path.join(root, relativeFile)
  const markdown = await fs.readFile(fullPath, 'utf8')
  const links = extractLinks(markdown)
  const anchors = collectAnchors(markdown)

  for (const link of links) {
    if (shouldSkip(link.href)) continue

    const [targetPathRaw, hashRaw] = link.href.split('#')
    const hash = hashRaw ? decodeURIComponent(hashRaw) : ''
    const targetPath = targetPathRaw ? decodeURIComponent(targetPathRaw) : ''
    const resolved = targetPath
      ? path.resolve(path.dirname(fullPath), targetPath)
      : fullPath

    if (targetPath) {
      try {
        await fs.stat(resolved)
      } catch {
        failures.push(`${relativeFile}:${link.line} missing link target ${link.href}`)
        continue
      }
    }

    if (hash && resolved.endsWith('.md')) {
      const targetMarkdown = resolved === fullPath ? markdown : await fs.readFile(resolved, 'utf8')
      const targetAnchors = resolved === fullPath ? anchors : collectAnchors(targetMarkdown)
      if (!targetAnchors.has(hash)) {
        failures.push(`${relativeFile}:${link.line} missing anchor ${link.href}`)
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Documentation check failed:')
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  process.exit(1)
}

console.log(`✓ Documentation links verified (${docs.length} files)`)

function extractLinks(markdown) {
  const links = []
  const lines = markdown.split(/\r?\n/)
  const inlineLinkPattern = /(?<!!)\[[^\]]+\]\(([^)]+)\)/g

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    let match
    while ((match = inlineLinkPattern.exec(line)) !== null) {
      links.push({
        href: match[1].trim(),
        line: index + 1,
      })
    }
  }

  return links
}

function shouldSkip(href) {
  return (
    href.length === 0 ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  )
}

function collectAnchors(markdown) {
  const anchors = new Set()
  const lines = markdown.split(/\r?\n/)

  for (const line of lines) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
    if (!match) continue
    anchors.add(slugify(match[2]))
  }

  return anchors
}

function slugify(value) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
}
