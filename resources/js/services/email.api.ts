import { api } from './api'

/**
 * API подтверждения почты: статус и повторная отправка ссылки.
 */
export interface EmailVerificationStatus {
  verified: boolean
  email: string | null
  verified_at: string | null
}

export const emailApi = {
  /**
   * Текущий статус верификации почты.
   *
   * @returns verified, email и дата подтверждения
   */
  async status(): Promise<EmailVerificationStatus> {
    const { data } = await api.get('/api/email/verification-status')
    return data as EmailVerificationStatus
  },

  /**
   * Отправить ссылку подтверждения повторно (троттлинг 6/мин на бэке).
   *
   * @returns статус отправки либо verified:true если уже подтверждена
   */
  async resend(): Promise<{ status?: string; verified?: boolean }> {
    const { data } = await api.post('/api/email/verification-notification')
    return data as { status?: string; verified?: boolean }
  },
}
