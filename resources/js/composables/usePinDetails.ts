import { ref } from 'vue'
import axios from 'axios'

export function usePinDetails() {
  const selectedPin = ref<any>(null)
  const comments = ref<any[]>([])
  const commentText = ref('')
  const reactionLoading = ref(false)
  const editingCommentId = ref<number|null>(null)
  const editingContent = ref('')

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
    if (reactionLoading.value) return
    reactionLoading.value = true
    try {
      const { data } = await axios.post('/api/reactions/toggle', { reactable_type: 'pin', reactable_id: pin.id, type })
      if (typeof data.reactions_count === 'number') pin.reactions_count = data.reactions_count
      else if (data.reacted === false) pin.reactions_count = Math.max(0, (pin.reactions_count || 1) - 1)
      else if (data.switched) {}
      else if (data.reacted) pin.reactions_count = (pin.reactions_count || 0) + 1
      if (typeof data.likes_count === 'number') pin.likes_count = data.likes_count
      if ('type' in data) pin.my_reaction = data.type
      else if (data.reacted === false) pin.my_reaction = null
    } finally { reactionLoading.value = false }
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
  function startEditComment(c:any){ editingCommentId.value=c.id; editingContent.value=c.content }
  function cancelEditComment(){ editingCommentId.value=null; editingContent.value='' }
  async function saveEditComment(){
    if(!editingCommentId.value) return
    if(!editingContent.value.trim()) return alert('Пустой комментарий')
    try{ const {data}=await axios.patch(`/api/comments/${editingCommentId.value}`, {content: editingContent.value.trim()}); const idx=comments.value.findIndex((x:any)=>x.id===editingCommentId.value); if(idx!==-1) comments.value[idx]={...comments.value[idx], ...data}; editingCommentId.value=null; editingContent.value='' } catch(e:any){ alert(e?.response?.data?.message || 'Ошибка редактирования (лимит 3/день)') }
  }

  return { selectedPin, comments, commentText, reactionLoading, editingCommentId, editingContent, openPin, closePin, loadComments, react, sendComment, reportPin, boost, startEditComment, cancelEditComment, saveEditComment }
}
