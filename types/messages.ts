import { EmployeeMessageStatus, UserStatus } from '@prisma/client';

export type SSEEventTypes =
  | 'chat_message'
  | 'user_status'
  | 'notification'
  | 'typing'
  | 'call_request'
  | 'call_accepted'
  | 'call_rejected'
  | 'call_ended';

export interface SSEMessage {
  type: SSEEventTypes;
  payload: unknown;
  receiverId?: string;
  timestamp?: string;
}

export type EmployeeMessageType = 'TEXT' | 'IMAGE' | 'FILE' | 'new_message' | 'typing';
export type ClientMessageStatus = EmployeeMessageStatus | 'SENDING' | 'FAILED' | 'DELIVERED' | 'READ' | 'RECEIVED' | 'PENDING';

// Base message interface for all message types
export interface BaseMessage {
  id: string; // Using CUID now instead of Int
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  createdAt: string;
  status: ClientMessageStatus;
  type: EmployeeMessageType;
}

export interface ChatMessagePayload extends SSEMessage {
  type: Extract<SSEEventTypes, 'chat_message' | 'typing'>
  payload: {
    id: string
    senderId: string
    receiverId: string
    content: string
    timestamp: string
  }
}

export interface MessageAPIPayload {
  id: string;  // Add id to the interface
  type: string;
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: string;
}

export interface EmployeeMessage extends BaseMessage {
  sender?: {
    avatar?: string;
    name?: string;
  };
}

export interface MessageResponse {
  success: boolean;
  data: EmployeeMessage;
}

export interface ChatContextType {
  createMessage: (content: string, receiverId: string) => Promise<void>;
  messages: EmployeeMessage[];
  isTyping: boolean;
  onlineUsers: Set<string>;
  lastSeen: Map<string, Date>;
  pendingMessages: Set<string>;
  // ... rest of existing properties
}
