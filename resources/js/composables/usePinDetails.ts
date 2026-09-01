import { ref } from 'vue'
import axios from 'axios'

export function usePinDetails() {
  const selectedPin = ref<any>(null)
  const comments = ref<any[]>([])
  const commentText = ref('')
  const reactionLoading = ref(false)

  function openPin(pin: any) {
    selectedPin.value = pin
    loadComments(pin.id)
  }

  function closePin() { selectedPin.value = null }

  async function loadComments(id: number) {
    const { data } = await axios.get(`/api/pins/${id}/comments`)
    comments.value = data.data || data
  }

  async function react(pin: any, type = 'like') {
    reactionLoading.value = true
    await axios.post('/api/reactions/toggle', { reactable_type: 'pin', reactable_id: pin.id, type })
    pin.reactions_count = (pin.reactions_count || 0) + 1
    reactionLoading.value = false
  }

  async function sendComment() {
    if (!commentText.value.trim() || !selectedPin.value) return
    await axios.post(`/api/pins/${selectedPin.value.id}/comments`, { content: commentText.value })
    commentText.value = ''
    await loadComments(selectedPin.value.id)
    selectedPin.value.comments_count = (selectedPin.value.comments_count || 0) + 1
  }

  async function reportPin(pin: any) {
    await axios.post('/api/reports', { target_type: 'pin', target_id: pin.id, reason: 'spam' })
    alert('Жалоба отправлена')
  }

  async function boost(pin: any, type: string) {
    await axios.post(`/api/pins/${pin.id}/boost`, { type })
    alert('Буст активирован: ' + type)
  }

  return { selectedPin, comments, commentText, reactionLoading, openPin, closePin, loadComments, react, sendComment, reportPin, boost }
}
