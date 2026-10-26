export interface Participant { userId: string; nickname: string; joinedAt: string; }
export interface RoomSnapshot { roomId: string; participants: Participant[]; }
export interface ParticipantChange { roomId: string; participant: Participant; }
export interface ChatMessage { id: string; roomId: string; sender: { userId: string; nickname: string }; text: string; createdAt: string; }
export interface OperationError { code: string; message: string; }
export type Result<T> = { ok: true; data: T } | { ok: false; error: OperationError };
export type Ack = (result: Result<unknown>) => void;
export interface ClientEvents {
  'room:join': (payload: { roomId: string }, ack?: Ack) => void;
  'room:leave': (payload: { roomId: string }, ack?: Ack) => void;
  'room:participants': (payload: { roomId: string }, ack?: Ack) => void;
  'chat:send': (payload: { roomId: string; text: string }, ack?: Ack) => void;
}
export interface ServerEvents {
  'participant:joined': (payload: ParticipantChange) => void;
  'participant:left': (payload: ParticipantChange) => void;
  'room:participants': (payload: RoomSnapshot) => void;
  'chat:message': (payload: ChatMessage) => void;
  'operation:error': (payload: OperationError) => void;
}
