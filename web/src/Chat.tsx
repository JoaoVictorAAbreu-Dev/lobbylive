import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  CornerDownLeft,
  Hash,
  LoaderCircle,
  LogOut,
  MessageSquare,
  Send,
  Users,
} from "lucide-react";
import type { Room, User } from "./api";
import type { Participant } from "../../src/realtime/contracts";
import type { Entry } from "./useLobby";
export function Chat({
  room,
  user,
  participants,
  entries,
  online,
  onBack,
  onLeave,
  onSend,
}: {
  room: Room;
  user: User;
  participants: Participant[];
  entries: Entry[];
  online: boolean;
  onBack: () => void;
  onLeave: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [entries]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim() || sending || !online) return;
    setSending(true);
    try {
      await onSend(text.trim());
      setText("");
    } catch {
      /* Parent displays the error; preserve the draft. */
    } finally {
      setSending(false);
    }
  }
  return (
    <div className="chat-view">
      <div className="chat-top">
        <button
          className="icon-button"
          aria-label="Voltar às salas"
          onClick={onBack}
        >
          <ArrowLeft size={19} />
        </button>
        <span className="room-icon">
          <Hash size={23} />
        </span>
        <div>
          <h1>{room.name}</h1>
          <p>
            <span className="live-dot" />
            {participants.length}{" "}
            {participants.length === 1
              ? "pessoa conectada"
              : "pessoas conectadas"}
          </p>
        </div>
        <button className="button secondary leave-button" onClick={onLeave}>
          <LogOut size={16} />
          Sair da sala
        </button>
      </div>
      <div className="chat-layout">
        <section className="conversation" aria-label="Conversa da sala">
          <div
            className="messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            <div className="conversation-welcome">
              <span className="welcome-hash">#</span>
              <h2>O encontro começa aqui.</h2>
              <p>
                Você está em <strong>{room.name}</strong>. Diga um oi para o
                time.
              </p>
              <span className="ephemeral-note">
                Chat ao vivo · sem histórico persistente
              </span>
            </div>
            {entries.map((entry) =>
              entry.kind === "notice" ? (
                <div className="system-entry" key={entry.id}>
                  <span />
                  {entry.text}
                  <span />
                </div>
              ) : (
                <div
                  className={`message-row ${entry.value.sender.userId === user.id ? "own" : ""}`}
                  key={entry.value.id}
                >
                  <span
                    className={`avatar ${entry.value.sender.userId === user.id ? "lime" : "violet"}`}
                  >
                    {entry.value.sender.nickname.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <div className="message-meta">
                      <strong>{entry.value.sender.nickname}</strong>
                      {entry.value.sender.userId === user.id ? (
                        <small>você</small>
                      ) : null}
                      <time dateTime={entry.value.createdAt}>
                        {new Date(entry.value.createdAt).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </time>
                    </div>
                    <p>{entry.value.text}</p>
                  </div>
                </div>
              ),
            )}
            <div ref={end} />
          </div>
          <form className="composer" onSubmit={submit}>
            <div className="composer-input">
              <MessageSquare size={18} />
              <input
                aria-label="Mensagem"
                placeholder={
                  online
                    ? `Conversar em #${room.name}...`
                    : "Reconecte para conversar"
                }
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={500}
                disabled={!online || sending}
              />
              <button
                className="send-button"
                aria-label="Enviar mensagem"
                disabled={!online || sending || !text.trim()}
              >
                {sending ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
            <div className="composer-help">
              <span>
                <CornerDownLeft size={12} /> Enter para enviar
              </span>
              <span>{text.length}/500</span>
            </div>
          </form>
        </section>
        <aside className="participants">
          <div className="participants-title">
            <h2>Na sala</h2>
            <span>
              {participants.length}/{room.capacity}
            </span>
          </div>
          {participants.map((participant) => (
            <div className="participant" key={participant.userId}>
              <span
                className={`avatar ${participant.userId === user.id ? "lime" : "violet"}`}
              >
                {participant.nickname.slice(0, 2).toUpperCase()}
                <i />
              </span>
              <div>
                <strong>{participant.nickname}</strong>
                <small>
                  {participant.userId === user.id ? "Você" : "Online agora"}
                </small>
              </div>
            </div>
          ))}
          <div className="presence-explainer">
            <Users size={19} />
            <p>
              Cada pessoa, uma vaga.
              <br />
              Mesmo com mais de uma conexão.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
