import { describe, expect, it } from 'vitest'
import { consumeLoginTokenFromLocation } from '@/utils/login-token'

describe('consumeLoginTokenFromLocation', () => {
  it('reads token from search params and removes it from the URL', () => {
    let replaced = ''
    const token = consumeLoginTokenFromLocation(
      {
        href: 'http://localhost:5173/?token=abc#/hermes/chat',
        hash: '#/hermes/chat',
      },
      (nextUrl) => {
        replaced = nextUrl
      },
    )

    expect(token).toBe('abc')
    expect(replaced).toBe('/#/hermes/chat')
  })

  it('reads token from hash query and preserves the rest of the hash query', () => {
    let replaced = ''
    const token = consumeLoginTokenFromLocation(
      {
        href: 'http://localhost:5173/#/hermes/chat?token=abc&foo=bar',
        hash: '#/hermes/chat?token=abc&foo=bar',
      },
      (nextUrl) => {
        replaced = nextUrl
      },
    )

    expect(token).toBe('abc')
    expect(replaced).toBe('/#/hermes/chat?foo=bar')
  })
})
