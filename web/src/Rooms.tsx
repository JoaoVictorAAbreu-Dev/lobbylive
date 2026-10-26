import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Hash,
  LoaderCircle,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { api, errorText } from "./api";
import type { Page, Room } from "./api";
export function RoomDirectory({
  page,
  loading,
  joined,
  counts,
  online,
  busy,
  onPage,
  onJoin,
  onCreate,
  onRefresh,
}: {
  page: Page<Room>;
  loading: boolean;
  joined: string[];
  counts: Record<string, number>;
  online: boolean;
  busy: string;
  onPage: (page: number) => void;
  onJoin: (room: Room) => void;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const rooms = page.data.filter((room) =>
    room.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">SEU TIME ESTÁ AQUI</div>
          <h1>
            Encontre seu próximo <span>lobby.</span>
          </h1>
          <p>Entre na conversa ou crie um espaço do seu jeito.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={17} />
          Criar sala
        </button>
      </div>
      <div className="directory-top">
        <div className="section-label">
          <span className="live-dot" />
          <h2>Explorar salas</h2>
          <span className="count-pill">{page.total}</span>
        </div>
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Buscar salas nesta página"
            placeholder="Buscar nesta página..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {loading ? (
        <div className="empty-panel" role="status">
          <LoaderCircle size={26} className="spin" />
          <h3>Buscando seus próximos encontros...</h3>
        </div>
      ) : rooms.length ? (
        <div className="room-grid">
          {rooms.map((room, index) => {
            const count = counts[room.id] ?? room.participantCount;
            const inside = joined.includes(room.id);
            return (
              <article className={`room-card tone-${index % 4}`} key={room.id}>
                <div className="card-top">
                  <span className="room-icon">
                    <Hash size={25} />
                  </span>
                  <span className={`room-tag ${inside ? "inside" : ""}`}>
                    {inside
                      ? "Você está aqui"
                      : count >= room.capacity
                        ? "Lotada"
                        : "Aberta"}
                  </span>
                </div>
                <h3>{room.name}</h3>
                <p className="room-owner">
                  Criada por <span>@{room.creator.nickname}</span>
                </p>
                <div className="capacity">
                  <div className="capacity-label">
                    <span>
                      <Users size={14} />
                      {count} / {room.capacity} participantes
                    </span>
                    <small>{room.capacity - count} vagas</small>
                  </div>
                  <div className="capacity-track">
                    <span
                      style={{
                        width: `${Math.min(100, (count / room.capacity) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <button
                  className="card-action"
                  disabled={!online || !!busy}
                  onClick={() => onJoin(room)}
                >
                  {busy === room.id ? (
                    <>
                      <LoaderCircle size={16} className="spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      {inside ? "Abrir conversa" : "Entrar na sala"}
                      <ArrowUpRight size={18} />
                    </>
                  )}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-panel">
          <span className="empty-icon">
            <Users size={30} />
          </span>
          <h3>
            {search
              ? "Nenhuma sala com esse nome."
              : "O próximo encontro pode ser seu."}
          </h3>
          <p>
            {search
              ? "A busca considera as salas desta página."
              : "Crie a primeira sala e convide alguém para conversar."}
          </p>
          <button
            className="button primary"
            onClick={search ? () => setSearch("") : onCreate}
          >
            {search ? "Limpar busca" : "Criar minha sala"}
            <Plus size={16} />
          </button>
        </div>
      )}
      <div className="directory-footer">
        <span>Salas persistem. As conversas acontecem no agora.</span>
        <div className="pagination">
          <button
            className="text-button"
            onClick={onRefresh}
            disabled={loading}
          >
            Atualizar
          </button>
          <button
            className="icon-button"
            aria-label="Página anterior"
            disabled={page.page <= 1 || loading}
            onClick={() => onPage(page.page - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Página {page.page} de{" "}
            {Math.max(1, Math.ceil(page.total / page.limit))}
          </span>
          <button
            className="icon-button"
            aria-label="Próxima página"
            disabled={page.page * page.limit >= page.total || loading}
            onClick={() => onPage(page.page + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <div className="quiet-callout">
        <span className="callout-symbol">↗</span>
        <div>
          <h3>Uma sala, várias conexões.</h3>
          <p>Abra mais de uma conversa. Seu espaço acompanha seu ritmo.</p>
        </div>
        <span className="callout-lines" aria-hidden="true">
          ✳
        </span>
      </div>
    </>
  );
}
export function CreateRoom({
  token,
  onClose,
  onCreated,
  onError,
}: {
  token: string;
  onClose: () => void;
  onCreated: (room: Room) => void;
  onError: (error: unknown) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    dialog.current?.querySelector("input")?.focus();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      onCreated(
        await api<Room>("/rooms", token, {
          name: String(data.get("name")).trim(),
          capacity: Number(data.get("capacity")),
        }),
      );
    } catch (failure) {
      setError(errorText(failure));
      onError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="create-dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
      aria-labelledby="create-title"
    >
      <div className="modal-heading">
        <span className="room-icon">
          <Hash size={24} />
        </span>
        <button
          className="icon-button"
          aria-label="Fechar criação de sala"
          onClick={onClose}
          disabled={pending}
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="create-title">Abra espaço para o seu time.</h2>
      <p>Dê um nome ao encontro. A conversa vem depois.</p>
      <form onSubmit={submit}>
        <label htmlFor="room-name">Nome da sala</label>
        <input
          id="room-name"
          name="name"
          autoFocus
          placeholder="Ex.: Squad da noite"
          required
          minLength={3}
          maxLength={60}
        />
        <label htmlFor="room-capacity">Número de participantes</label>
        <input
          id="room-capacity"
          name="capacity"
          type="number"
          min={2}
          max={16}
          defaultValue={8}
          required
        />
        <small>De 2 a 16 pessoas. Uma conta ocupa uma vaga.</small>
        {error ? (
          <p className="inline-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button primary auth-submit" disabled={pending}>
          {pending ? (
            <LoaderCircle size={17} className="spin" />
          ) : (
            <Plus size={17} />
          )}
          Criar sala
        </button>
      </form>
    </dialog>
  );
}
