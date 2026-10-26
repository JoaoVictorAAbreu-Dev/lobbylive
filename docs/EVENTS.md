# Protocolo Socket.IO — LobbyLive v1

REST/Swagger documentam HTTP; esta tabela documenta os eventos. Tipos TypeScript em `src/realtime/contracts.ts`.

## Conexão

```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3002/lobby', {
  auth: { token: accessToken },
  transports: ['websocket'],
  reconnection: false,
});
```

Namespace **`/lobby`**, caminho Engine.IO **`/socket.io`**, mesma porta do HTTP. Use cliente Socket.IO 4; um cliente WebSocket puro não implementa o protocolo Socket.IO. Tokens não devem ser enviados na URL.

Middleware valida assinatura HS256, emissor/audiência `lobbylive`, validade e existência da conta. Falha causa `connect_error` com `data: { code: 'UNAUTHORIZED', message }`. O token expira em uma hora; a conexão é encerrada na expiração. Novo login/token e conexão são necessários.

## Comandos cliente → servidor

| Comando | Payload | `data` no ack de sucesso |
|---|---|---|
| `room:join` | `{ roomId }` | Snapshot `{ roomId, participants }` |
| `room:leave` | `{ roomId }` | `{ roomId, left }`, indicando se esta conexão estava ativa |
| `room:participants` | `{ roomId }` | Snapshot, somente para membro dessa conexão |
| `chat:send` | `{ roomId, text }` | Mensagem aceita e emitida |

UUID é normalizado para minúsculas. Texto é normalizado com trim e deve ter 1–500 caracteres. Campos extras são rejeitados. Payload máximo de transporte: 16 KiB.

```javascript
socket.timeout(5000).emit('room:join', { roomId }, (timeoutError, result) => {
  if (timeoutError) return; // Resultado desconhecido: consultar estado ao reconectar.
  if (!result.ok) console.error(result.error.code);
  else console.log(result.data);
});
```

Sucesso: `{ ok: true, data }`. Falha: `{ ok: false, error: { code, message } }`. Sem callback, o servidor emite falhas em `operation:error`; para obter snapshots sem mudanças de presença, use callback. Falha de transporte não garante que uma mensagem não tenha sido processada; não há idempotência de chat nesta versão.

| Código | Significado |
|---|---|
| `VALIDATION_ERROR` | Payload, UUID, texto ou campos extras inválidos |
| `UNAUTHORIZED` | Token inválido/expirado ou conexão encerrada |
| `ROOM_NOT_FOUND` | Sala inexistente |
| `ROOM_FULL` | Capacidade esgotada para uma nova conta |
| `NOT_IN_ROOM` | Esta conexão precisa entrar antes de consultar participantes/enviar chat |
| `JOIN_CANCELLED` | Entrada cancelada antes da confirmação |
| `INTERNAL_ERROR` | Falha inesperada sem detalhes internos |

## Eventos servidor → membros da sala

| Evento | Payload | Quando |
|---|---|---|
| `participant:joined` | `{ roomId, participant }` | Primeira conexão ativa da conta |
| `participant:left` | `{ roomId, participant }` | Última conexão ativa da conta saiu/desconectou |
| `room:participants` | `{ roomId, participants }` | Após mudança efetiva da presença |
| `chat:message` | `{ id, roomId, sender, text, createdAt }` | Mensagem aceita, incluindo o remetente |

`participant = { userId, nickname, joinedAt }`. `sender = { userId, nickname }`. IDs e datas ISO/UTC são gerados pelo servidor. Snapshots não incluem IDs de sockets, senha, hash ou token.

Uma conta ocupa uma vaga por sala. Pode conectar vários clientes e participar de várias salas. Cada conexão entra/sai explicitamente; sair em um cliente não remove outro cliente da mesma conta. Repetir entrada não gera outro evento; repetir saída retorna `left: false`.

Reconexão cria nova associação vazia. O servidor não recupera salas ou mensagens automaticamente. Mensagens são transitórias, com a garantia padrão de entrega do Socket.IO; a ordem é preservada entre mensagens que chegam. O processo não oferece replay ou garantia de entrega após perda de conexão.

## Cliente interativo

1. Cadastre duas contas e faça login pelo Swagger.
2. Crie uma sala via `POST /api/v1/rooms` com Bearer JWT.
3. Em cada terminal Bash, carregue o token da respectiva conta sem colocá-lo no histórico:

```bash
read -rsp 'Access token: ' LOBBY_TOKEN
export LOBBY_TOKEN
npm run client
unset LOBBY_TOKEN
```

4. Digite `/join UUID_DA_SALA` nos dois terminais.
5. Use `/say UUID_DA_SALA Olá`, `/participants UUID_DA_SALA`, `/leave UUID_DA_SALA` e `/quit`.

O cliente imprime eventos e resultados, nunca o token. Para outra API, defina `LOBBY_URL`. Para demonstração sem manusear credenciais, prefira `npm run demo`.
