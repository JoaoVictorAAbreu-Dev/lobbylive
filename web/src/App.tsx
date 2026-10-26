import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Compass,
  Hash,
  LoaderCircle,
  LogOut,
  Plus,
  RadioTower,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Auth, Brand } from "./Auth";
import { api, ApiFailure, errorText } from "./api";
import type { Page, Room, Session } from "./api";
import { useLobby } from "./useLobby";
import { CreateRoom, RoomDirectory } from "./Rooms";
import { Chat } from "./Chat";
export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const expire = useCallback(() => {
    setNotice("Sua sessão expirou. Entre novamente para continuar.");
    setSession(null);
  }, []);
  return session ? (
    <Lobby
      session={session}
      onExpire={expire}
      onLogout={() => {
        setSession(null);
        setNotice("");
      }}
    />
  ) : (
    <Auth
      onLogin={(value) => {
        setSession(value);
        setNotice("");
      }}
      initialNotice={notice}
    />
  );
}
function Lobby({
  session,
  onExpire,
  onLogout,
}: {
  session: Session;
  onExpire: () => void;
  onLogout: () => void;
}) {
  const [page, setPage] = useState<Page<Room>>({
    data: [],
    total: 0,
    page: 1,
    limit: 9,
  });
  const [pageNumber, setPageNumber] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState("");
  const [active, setActive] = useState<Room | null>(null);
  const [known, setKnown] = useState<Record<string, Room>>({});
  const lobby = useLobby(session, onExpire);
  function failed(failure: unknown) {
    if (
      failure instanceof ApiFailure &&
      (failure.status === 401 || failure.code === "UNAUTHORIZED")
    )
      onExpire();
    else setError(errorText(failure));
  }
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Page<Room>>(`/rooms?page=${pageNumber}&limit=9`, session.token)
      .then((value) => {
        if (!cancelled) {
          setPage(value);
          setKnown((old) => ({
            ...old,
            ...Object.fromEntries(value.data.map((room) => [room.id, room])),
          }));
        }
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          if (failure instanceof ApiFailure && failure.status === 401)
            onExpire();
          else setError(errorText(failure));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageNumber, revision, session.token, onExpire]);
  function refresh() {
    setRevision((old) => old + 1);
  }
  async function open(room: Room) {
    if (busy) return;
    setBusy(room.id);
    setError("");
    try {
      await lobby.join(room.id);
      setKnown((old) => ({ ...old, [room.id]: room }));
      setActive(room);
    } catch (failure) {
      failed(failure);
    } finally {
      setBusy("");
    }
  }
  async function leave(room: Room) {
    if (busy) return;
    setBusy(room.id);
    try {
      await lobby.leave(room.id);
      setActive(null);
      refresh();
    } catch (failure) {
      failed(failure);
    } finally {
      setBusy("");
    }
  }
  const online = lobby.status === "online";
  const counts = Object.fromEntries(
    Object.entries(lobby.snapshots).map(([id, snapshot]) => [
      id,
      snapshot.participants.length,
    ]),
  );
  const selected = active && lobby.joined.includes(active.id) ? active : null;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">SEU ESPAÇO</div>
        <button
          className={`nav-item ${!selected ? "active" : ""}`}
          onClick={() => {
            setActive(null);
            refresh();
          }}
        >
          <Compass size={18} />
          Explorar salas
          <ArrowUpRight size={14} />
        </button>
        <div className="joined-heading">
          <span>SUAS SALAS</span>
          <button
            className="icon-button"
            aria-label="Criar sala"
            onClick={() => setModal(true)}
          >
            <Plus size={16} />
          </button>
        </div>
        <nav className="joined-nav" aria-label="Salas abertas">
          {lobby.joined.length ? (
            lobby.joined.map((id) => (
              <button
                className={`joined-room ${selected?.id === id ? "selected" : ""}`}
                key={id}
                onClick={() => setActive(known[id])}
              >
                <Hash size={16} />
                <span>{known[id]?.name ?? "Sala"}</span>
                <small>{counts[id] ?? 0}</small>
              </button>
            ))
          ) : (
            <p className="no-rooms">
              Seu próximo encontro
              <br />
              ainda está por começar.
            </p>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <RadioTower size={21} />
            <strong>Feito para conectar.</strong>
            <p>
              Seu time pode estar
              <br />a uma sala de distância.
            </p>
          </div>
          <div className="user-box">
            <span className="avatar lime">
              {session.user.nickname.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{session.user.nickname}</strong>
              <span>
                <i />
                Disponível para jogar
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Sair da conta"
              title="Sair da conta"
              onClick={onLogout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span>/</span>
            <strong>{selected ? "Sua sala" : "Explorar"}</strong>
          </div>
          <div className={`connection-status ${online ? "" : "disconnected"}`}>
            {online ? (
              <Wifi size={14} />
            ) : lobby.status === "connecting" ? (
              <LoaderCircle className="spin" size={14} />
            ) : (
              <WifiOff size={14} />
            )}
            <span>
              {online
                ? "Em tempo real"
                : lobby.status === "connecting"
                  ? "Conectando"
                  : "Desconectado"}
            </span>
            {lobby.status === "offline" ? (
              <button onClick={lobby.reconnect}>Reconectar</button>
            ) : (
              <i />
            )}
          </div>
        </header>
        {error || lobby.notice ? (
          <div className="notification" role="alert">
            <span>{error || lobby.notice}</span>
            <button
              className="icon-button"
              aria-label="Fechar aviso"
              onClick={() => {
                setError("");
                lobby.setNotice("");
              }}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
        <main className={`content ${selected ? "with-chat" : ""}`}>
          {selected ? (
            <Chat
              key={selected.id}
              room={selected}
              user={session.user}
              participants={lobby.snapshots[selected.id]?.participants ?? []}
              entries={lobby.entries[selected.id] ?? []}
              online={online}
              onBack={() => {
                setActive(null);
                refresh();
              }}
              onLeave={() => void leave(selected)}
              onSend={async (text) => {
                try {
                  await lobby.send(selected.id, text);
                } catch (failure) {
                  failed(failure);
                  throw failure;
                }
              }}
            />
          ) : (
            <RoomDirectory
              page={page}
              loading={loading}
              joined={lobby.joined}
              counts={counts}
              online={online}
              busy={busy}
              onPage={setPageNumber}
              onJoin={(room) => void open(room)}
              onCreate={() => setModal(true)}
              onRefresh={refresh}
            />
          )}
        </main>
        <footer className="app-footer">
          <span>
            <span className="footer-brand">lobbylive</span> — encontros que
            viram partidas.
          </span>
          <span>
            <i />
            Converse. Conecte. Jogue.
          </span>
        </footer>
      </div>
      {modal ? (
        <CreateRoom
          token={session.token}
          onClose={() => setModal(false)}
          onError={failed}
          onCreated={(room) => {
            setModal(false);
            setPageNumber(1);
            refresh();
            setKnown((old) => ({ ...old, [room.id]: room }));
            if (online) void open(room);
          }}
        />
      ) : null}
    </div>
  );
}
