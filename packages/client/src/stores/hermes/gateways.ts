import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchGateways, startGateway, stopGateway, type GatewayStatus } from '@/api/hermes/gateways'

export const useGatewayStore = defineStore('gateways', () => {
  const gateways = ref<GatewayStatus[]>([])
  const loading = ref(false)
  const hasFetched = ref(false)

  async function fetchStatus() {
    loading.value = true
    try {
      const data = await fetchGateways()
      gateways.value = Array.isArray(data) ? data : Object.values(data || {})
      hasFetched.value = true
    } catch (err) {
      hasFetched.value = true
      throw err
    } finally {
      loading.value = false
    }
  }

  async function start(name: string) {
    loading.value = true
    try {
      const status = await startGateway(name)
      // Update the specific gateway in the list
      const idx = gateways.value.findIndex(g => g.profile === name)
      if (idx >= 0) {
        gateways.value[idx] = status
      } else {
        gateways.value.push(status)
      }
      return status
    } catch (err) {
      await fetchStatus()
      throw err
    } finally {
      loading.value = false
    }
  }

  async function stop(name: string) {
    loading.value = true
    try {
      await stopGateway(name)
      // Update the specific gateway in the list
      const gw = gateways.value.find(g => g.profile === name)
      if (gw) {
        gw.running = false
        gw.pid = undefined
        gw.lastError = undefined
        gw.lastErrorAt = undefined
      }
    } catch (err) {
      await fetchStatus()
      throw err
    } finally {
      loading.value = false
    }
  }

  return { gateways, loading, hasFetched, fetchStatus, start, stop }
})
