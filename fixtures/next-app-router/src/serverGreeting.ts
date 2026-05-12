export function serverGreeting(name: string): string {
  if (name.length === 0) {
    return 'Hello, anonymous'
  }

  return `Hello, ${name}`
}
