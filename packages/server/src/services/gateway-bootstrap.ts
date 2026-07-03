let gatewayManager: any = null
let gatewayInitPromise: Promise<void> | null = null

export function getGatewayManagerInstance(): any {
  return gatewayManager
}

export async function initGatewayManager(): Promise<void> {
  if (gatewayInitPromise) return gatewayInitPromise

  const { GatewayManager } = await import('./hermes/gateway-manager')
  const { getActiveProfileName } = await import('./hermes/hermes-profile')
  const activeProfile = getActiveProfileName()
  gatewayManager = new GatewayManager(activeProfile)

  gatewayInitPromise = (async () => {
    try {
      await gatewayManager.detectAllOnStartup()
      await gatewayManager.startAll()
      console.log('startall')
    } catch (err: any) {
      console.error('[gateway-bootstrap] init failed:', err?.message || err)
    }
  })()

  return gatewayInitPromise
}
