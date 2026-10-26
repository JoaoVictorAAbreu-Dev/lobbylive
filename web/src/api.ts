export interface User {
  id: string;
  nickname: string;
  createdAt: string;
}
export interface Room {
  id: string;
  name: string;
  capacity: number;
  participantCount: number;
  creator: { id: string; nickname: string };
  createdAt: string;
}
export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
export interface Session {
  user: User;
  token: string;
  expiresAt: number;
}
export class ApiFailure extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
  ) {
    super(message);
  }
}
export const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Algo não saiu como esperado. Tente novamente.";
const descriptions: Record<string, string> = {
  ROOM_FULL: "Essa sala está cheia. Tente outra sala ou crie a sua.",
  ROOM_NOT_FOUND: "Não encontramos essa sala. Atualize a lista.",
  NICKNAME_TAKEN: "Esse nickname já está em uso. Escolha outro.",
  INVALID_CREDENTIALS: "Nickname ou senha incorretos.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente.",
  NOT_IN_ROOM: "Entre na sala antes de enviar mensagens.",
  VALIDATION_ERROR: "Confira os campos e tente novamente.",
  INTERNAL_ERROR: "O servidor encontrou um problema. Tente novamente.",
};
export function operationError(code: string, message?: string) {
  return new ApiFailure(
    code,
    descriptions[code] ?? message ?? "Não foi possível concluir a operação.",
  );
}
export async function api<T>(
  path: string,
  token?: string,
  body?: object,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiFailure(
      "NETWORK_ERROR",
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiFailure(
      data?.code ?? "HTTP_ERROR",
      descriptions[data?.code] ??
        data?.message ??
        "Serviço indisponível. Tente novamente.",
      response.status,
    );
  return data as T;
}
