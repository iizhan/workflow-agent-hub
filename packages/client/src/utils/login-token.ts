export function consumeLoginTokenFromLocation(
  locationLike: Pick<Location, 'href' | 'hash'>,
  replaceUrl?: (nextUrl: string) => void,
): string | null {
  const url = new URL(locationLike.href)
  const searchParams = new URLSearchParams(url.search)
  const [hashPath, hashQuery = ''] = (locationLike.hash || '').split('?')
  const hashParams = new URLSearchParams(hashQuery)

  const token = searchParams.get('token') || hashParams.get('token')
  if (!token) return null

  searchParams.delete('token')
  hashParams.delete('token')

  const nextSearch = searchParams.toString()
  const nextHashQuery = hashParams.toString()
  const nextHash = hashPath
    ? nextHashQuery
      ? `${hashPath}?${nextHashQuery}`
      : hashPath
    : ''
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${nextHash}`

  replaceUrl?.(nextUrl)
  return token
}
