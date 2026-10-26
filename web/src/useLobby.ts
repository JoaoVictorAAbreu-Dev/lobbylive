import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type {
  ChatMessage,
  ParticipantChange,
  RoomSnapshot,
  Result,
} from "../../src/realtime/contracts";
import type { Session } from "./api";
import { operationError } from "./api";
export type Entry =
  | { kind: "message"; value: ChatMessage }
  | { kind: "notice"; id: string; text: string };
export function useLobby(session: Session, onExpire: () => void) {
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">(
    "connecting",
  );
  const [joined, setJoined] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, RoomSnapshot>>({});
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const socket = io("/lobby", {
      auth: { token: session.token },
      transports: ["websocket"],
      reconnection: false,
    });
    socketRef.current = socket;
    const append = (roomId: string, entry: Entry) =>
      setEntries((old) => ({
        ...old,
        [roomId]: [...(old[roomId] ?? []), entry].slice(-300),
      }));
    socket.on("connect", () => {
      setStatus("online");
      setNotice("");
    });
    socket.on("disconnect", () => {
      setStatus("offline");
      setJoined([]);
      setSnapshots({});
      setEntries({});
      setNotice("Conexão encerrada. Reconecte e entre novamente nas salas.");
    });
    socket.on(
      "connect_error",
      (error: Error & { data?: { code?: string } }) => {
        setStatus("offline");
        if (error.data?.code === "UNAUTHORIZED") onExpire();
        else
          setNotice(
            "Servidor indisponível. Confira sua conexão e tente reconectar.",
          );
      },
    );
    socket.on("room:participants", (snapshot: RoomSnapshot) =>
      setSnapshots((old) => ({ ...old, [snapshot.roomId]: snapshot })),
    );
    socket.on("chat:message", (message: ChatMessage) => {
      setEntries((old) => {
        const previous = old[message.roomId] ?? [];
        if (
          previous.some(
            (entry) =>
              entry.kind === "message" && entry.value.id === message.id,
          )
        )
          return old;
        return {
          ...old,
          [message.roomId]: [
            ...previous,
            { kind: "message" as const, value: message },
          ].slice(-300),
        };
      });
    });
    socket.on(
      "participant:joined",
      ({ roomId, participant }: ParticipantChange) =>
        append(roomId, {
          kind: "notice",
          id: crypto.randomUUID(),
          text:
            participant.userId === session.user.id
              ? "Você entrou na sala."
              : `${participant.nickname} entrou na sala.`,
        }),
    );
    socket.on(
      "participant:left",
      ({ roomId, participant }: ParticipantChange) =>
        append(roomId, {
          kind: "notice",
          id: crypto.randomUUID(),
          text: `${participant.nickname} saiu da sala.`,
        }),
    );
    socket.on("operation:error", (error: { code: string; message: string }) =>
      setNotice(operationError(error.code, error.message).message),
    );
    const timer = window.setTimeout(
      onExpire,
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session, onExpire]);
  const command = useCallback(
    <T>(name: string, payload: object): Promise<T> => {
      const socket = socketRef.current;
      if (!socket?.connected)
        return Promise.reject(
          operationError("OFFLINE", "Reconecte para continuar."),
        );
      return new Promise((resolve, reject) =>
        socket
          .timeout(5000)
          .emit(name, payload, (error: Error | null, result: Result<T>) => {
            if (error)
              reject(
                operationError(
                  "TIMEOUT",
                  "Não recebemos confirmação. Verifique o estado da sala antes de tentar novamente.",
                ),
              );
            else if (!result?.ok)
              reject(
                operationError(
                  result?.error?.code ?? "INTERNAL_ERROR",
                  result?.error?.message,
                ),
              );
            else resolve(result.data);
          }),
      );
    },
    [],
  );
  async function join(roomId: string) {
    const snapshot = await command<RoomSnapshot>("room:join", { roomId });
    setJoined((old) => (old.includes(roomId) ? old : [...old, roomId]));
    setSnapshots((old) => ({ ...old, [roomId]: snapshot }));
  }
  async function leave(roomId: string) {
    await command("room:leave", { roomId });
    setJoined((old) => old.filter((id) => id !== roomId));
    setSnapshots((old) => {
      const next = { ...old };
      delete next[roomId];
      return next;
    });
    setEntries((old) => {
      const next = { ...old };
      delete next[roomId];
      return next;
    });
  }
  function reconnect() {
    setStatus("connecting");
    setNotice("");
    socketRef.current?.connect();
  }
  return {
    status,
    joined,
    snapshots,
    entries,
    notice,
    setNotice,
    join,
    leave,
    reconnect,
    send: (roomId: string, text: string) =>
      command<ChatMessage>("chat:send", { roomId, text }),
  };
}
