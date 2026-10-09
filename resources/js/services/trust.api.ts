import { api } from '@/services/api'

/** Своя репутация: скор 1–10, подпись зоны и расшифровка. */
export interface TrustState {
  score: number
  label: string
  hint: string
}

export const trustApi = {
  /**
   * Своя репутация для настроек профиля.
   * @returns скор и его зона
   */
  async me() {
    const { data } = await api.get('/api/trust/me')
    return data as TrustState
  },
}
