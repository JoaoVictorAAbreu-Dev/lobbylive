import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowUpRight,
  Check,
  LoaderCircle,
  RadioTower,
  ShieldCheck,
  Users,
} from "lucide-react";
import { api, errorText } from "./api";
import type { Session, User } from "./api";
export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <RadioTower size={20} />
      </span>
      lobby<span className="brand-light">live</span>
      <span className="brand-dot" />
    </span>
  );
}
export function Auth({
  onLogin,
  initialNotice,
}: {
  onLogin: (session: Session) => void;
  initialNotice: string;
}) {
  const [register, setRegister] = useState(false);
  const [error, setError] = useState(initialNotice);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const data = new FormData(event.currentTarget);
    const credentials = {
      nickname: String(data.get("nickname")).trim().toLowerCase(),
      password: String(data.get("password")),
    };
    try {
      if (register) await api<User>("/auth/register", undefined, credentials);
      const login = await api<{ accessToken: string; expiresIn: number }>(
        "/auth/login",
        undefined,
        credentials,
      );
      const user = await api<User>("/auth/me", login.accessToken);
      onLogin({
        user,
        token: login.accessToken,
        expiresAt: Date.now() + login.expiresIn * 1000,
      });
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-story">
        <Brand />
        <div className="auth-copy">
          <div className="eyebrow">
            <span className="live-dot" /> CONEXÕES REAIS. EM TEMPO REAL.
          </div>
          <h1>
            O melhor do jogo
            <br />
            começa no <em>lobby.</em>
          </h1>
          <p>
            Encontre sua sala, reúna seu time e deixe a conversa acontecer. O
            próximo encontro começa aqui.
          </p>
          <div className="orbit-scene" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="floating-card float-left">
              <span className="avatar violet">A</span>
              <div>
                <strong>Seu time está chegando</strong>
                <small>Presença em tempo real</small>
              </div>
              <span className="live-dot" />
            </div>
            <div className="floating-card float-right">
              <span className="avatar lime">
                <Users size={22} />
              </span>
              <div>
                <strong>Um espaço para conectar</strong>
                <small>Seu próximo lobby</small>
              </div>
              <ArrowUpRight size={18} />
            </div>
            <div className="orbit-core">
              <RadioTower size={42} />
            </div>
          </div>
          <div className="auth-perks">
            <span>
              <Check size={14} /> Salas para o seu time
            </span>
            <span>
              <Check size={14} /> Chat ao vivo
            </span>
          </div>
        </div>
        <p className="auth-foot">Menos espera. Mais conexão.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-form-wrap">
          <div className="eyebrow">SEU PONTO DE ENCONTRO</div>
          <h2>
            {register ? "Faça parte do lobby." : "Bom ter você por aqui."}
          </h2>
          <p>
            {register
              ? "Crie sua conta e encontre sua próxima sala."
              : "Entre na sua conta para encontrar seu time."}
          </p>
          <div className="auth-tabs" aria-label="Acesso">
            <button
              type="button"
              className={!register ? "selected" : ""}
              onClick={() => {
                setRegister(false);
                setError("");
              }}
              disabled={pending}
            >
              Entrar
            </button>
            <button
              type="button"
              className={register ? "selected" : ""}
              onClick={() => {
                setRegister(true);
                setError("");
              }}
              disabled={pending}
            >
              Criar conta
            </button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              name="nickname"
              placeholder="seu_nickname"
              autoComplete="username"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_]+"
              aria-describedby="nickname-help"
            />
            <small id="nickname-help">
              3–30 caracteres. Letras, números e _.
            </small>
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Sua senha"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={12}
              maxLength={128}
            />
            <small>Mínimo de 12 caracteres.</small>
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button primary auth-submit" disabled={pending}>
              {pending ? <LoaderCircle size={18} className="spin" /> : null}
              {register ? "Criar conta e entrar" : "Entrar no LobbyLive"}
              {!pending ? <ArrowUpRight size={18} /> : null}
            </button>
          </form>
          <div className="secure-note">
            <ShieldCheck size={17} />
            <p>
              Sua sessão fica apenas nesta aba.
              <br />
              Ao recarregar, entre novamente.
            </p>
          </div>
        </div>
        <p className="panel-foot">Seu time. Seu espaço. Seu próximo jogo.</p>
      </div>
    </main>
  );
}
