export interface ChatUserBrief { id:number; name:string; avatar_path:string|null; avatar_url?:string|null; can_message?:boolean; message_privacy?:string; }
export interface MessageReply { id:number; body:string; sender_id:number; sender_name?:string|null; kind?:string|null; duration?:number|null }
/**
 * Пересланный пост в сообщении: живое превью + диплинк.
 * type flow → /flow/post/:id, district → /districts/:districtId?post=:id.
 */
export interface SharedPostPayload { type: 'flow' | 'district'; id: number; district_id?: number | null; district_name?: string | null; title: string | null; excerpt: string | null; image_url: string | null; author_name: string | null; url: string | null; unavailable?: boolean }
export type SharedPostRef = { type: 'flow' | 'district'; id: number; district_id?: number | null; title?: string | null; excerpt?: string | null; image_url?: string | null; author_name?: string | null }
export interface ChatAttachmentPayload { url: string | null; name: string | null; mime: string | null; size: number | null; kind: 'image' | 'file' | 'voice' | null; duration?: number | null }
export interface Message { id:number; conversation_id:number; reply_to_id?:number|null; reply_to?:MessageReply|null; shared_post?:SharedPostPayload|null; sender_id:number; body:string; type:string; attachment?: ChatAttachmentPayload | null; created_at:string; edited_at?:string|null; delivered_at?:string|null; read_at?:string|null; status?:'sent'|'delivered'|'read'; is_edited?:boolean; is_pinned?:boolean; pinned_at?:string|null; pinned_by?:number|null; sender?: ChatUserBrief }
/** Общий фон беседы: один на всех участников, меняется у всех сразу. */
export interface ChatWallpaper { type: 'none' | 'preset' | 'color' | 'image'; preset: string | null; color: string | null; image_url: string | null; updated_at?: string | null }
export interface Conversation { id:number; type?:string; district_id?:number|null; title?:string|null; can_invite?:boolean; other: ChatUserBrief|null; last_message: Message|null; unread_count:number; last_message_at:string|null; updated_at:string; wallpaper?: ChatWallpaper | null }
export interface ConversationDetail { id:number; type?:string; district_id?:number|null; title?:string|null; can_invite?:boolean; other: ChatUserBrief|null; participants: ChatUserBrief[]; messages: Message[]; messages_has_more?: boolean; pinned?: Message[]; pin_limit?: number|null; wallpaper?: ChatWallpaper | null }
export interface Friendship { id:number; requester_id:number; addressee_id:number; status:'pending'|'accepted'|'declined'|'blocked'; is_hidden?:boolean; requester?:ChatUserBrief; addressee?:ChatUserBrief; other?:ChatUserBrief; created_at?:string }
export interface FriendshipsState { friends:Friendship[]; pending_in:any[]; pending_out:any[]; hidden_limit?:number|null; hidden_count?:number; hidden_unlimited?:boolean }
