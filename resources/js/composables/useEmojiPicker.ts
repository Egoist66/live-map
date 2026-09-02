import { ref } from 'vue'

export const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'Часто', emojis: ['😀','😂','😍','🥰','😎','🤔','😮','😢','😡','👍','👎','❤️','🔥','🎉','🙏','👏'] },
  { label: 'Эмоции', emojis: ['😊','😇','🤩','😌','🥳','😅','🤣','😭','🥺','😤','🤯','🥶','😱','🤠','🥴','😴'] },
  { label: 'Жесты', emojis: ['👋','🤝','💪','👌','✌️','🤞','🫶','🙌','🤲','👊','✊','🤙','💅','🫡','🫠'] },
  { label: 'Символы', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','💯','✅','❌','⭐','✨','💥'] },
]

export const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis)

export function useEmojiPicker() {
  const open = ref(false)
  function toggle() { open.value = !open.value }
  function close() { open.value = false }
  function insertEmoji(current: string, emoji: string, cursorPos?: number): { text: string; cursor: number } {
    if (cursorPos === undefined) return { text: current + emoji, cursor: current.length + emoji.length }
    return { text: current.slice(0, cursorPos) + emoji + current.slice(cursorPos), cursor: cursorPos + emoji.length }
  }
  return { open, toggle, close, insertEmoji, EMOJI_GROUPS, ALL_EMOJIS }
}
