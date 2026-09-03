export function getAvatarUrl(user: any): string | null {
  if (!user) return null
  if (user.avatar_url) return user.avatar_url
  if (user.avatar_path) return `/storage/${user.avatar_path}`
  return null
}
export function avatarSrcFor(user: any): string {
  return getAvatarUrl(user) ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'U')}&background=0F172A&color=fff&bold=true`
}
