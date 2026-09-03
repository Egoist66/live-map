export interface ChatUserBrief { id:number; name:string; avatar_path:string|null; avatar_url?:string|null; can_message?:boolean; message_privacy?:string; }
export interface Message { id:number; conversation_id:number; sender_id:number; body:string; type:string; created_at:string; edited_at?:string|null; delivered_at?:string|null; read_at?:string|null; status?:'sent'|'delivered'|'read'; is_edited?:boolean; sender?: ChatUserBrief }
export interface Conversation { id:number; other: ChatUserBrief|null; last_message: Message|null; unread_count:number; last_message_at:string|null; updated_at:string; }
export interface ConversationDetail { id:number; other: ChatUserBrief|null; participants: ChatUserBrief[]; messages: Message[] }
export interface Friendship { id:number; requester_id:number; addressee_id:number; status:'pending'|'accepted'|'declined'|'blocked'; requester?:ChatUserBrief; addressee?:ChatUserBrief; other?:ChatUserBrief; created_at?:string }
export interface FriendshipsState { friends:Friendship[]; pending_in:any[]; pending_out:any[] }
