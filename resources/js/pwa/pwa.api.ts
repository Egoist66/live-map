import { api } from '@/services/api'
import type { SaveSubscriptionPayload } from './types'

export async function savePushSubscription(payload: SaveSubscriptionPayload): Promise<void> {
  await api.post('/api/push-subscriptions', payload)
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await api.delete('/api/push-subscriptions', { data: { endpoint } })
}

export async function sendTestPush(): Promise<void> {
  await api.post('/api/push-subscriptions/test')
}
