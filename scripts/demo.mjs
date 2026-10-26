import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { connect, command, nextEvent } from './socket-tools.mjs';
const url = process.env.LOBBY_URL ?? 'http://127.0.0.1:3002';
const sockets = [];
const waiting = [];
async function rest(path, body, token) {
  const response = await fetch(`${url}/api/v1${path}`, { method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(5000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`${path}: ${data.code ?? response.status}`);
  return data;
}
function listen(socket, name, predicate) {
  const result = nextEvent(socket, name, predicate); waiting.push(result);
  // Prevent an unhandled rejection if an earlier assertion aborts the demonstration.
  result.promise.catch(() => undefined); return result.promise;
}
try {
  const prefix = `demo_${randomBytes(4).toString('hex')}`;
  const credentials = [1, 2].map((n) => ({ nickname: `${prefix}_${n}`, password: randomBytes(24).toString('base64url') }));
  const users = [];
  for (const c of credentials) users.push(await rest('/auth/register', c));
  const tokens = [];
  for (const c of credentials) tokens.push((await rest('/auth/login', c)).accessToken);
  const room = await rest('/rooms', { name: `Demo ${prefix}`, capacity: 2 }, tokens[0]);
  const a = await connect(url, tokens[0]); sockets.push(a);
  const b = await connect(url, tokens[1]); sockets.push(b);
  await command(a, 'room:join', { roomId: room.id });
  const joined = listen(a, 'participant:joined', (v) => v.participant.userId === users[1].id);
  const snapshot = await command(b, 'room:join', { roomId: room.id });
  await joined; assert.equal(snapshot.participants.length, 2);
  console.log('PASS: dois clientes autenticados e duas contas presentes.');
  const received = listen(b, 'chat:message');
  const sent = await command(a, 'chat:send', { roomId: room.id, text: 'Olá do cliente A para o cliente B!' });
  assert.deepEqual(await received, sent); assert.equal(sent.sender.userId, users[0].id);
  console.log('PASS: chat recebido somente no contexto da sala, com remetente autenticado.');
  const left = listen(a, 'participant:left', (v) => v.participant.userId === users[1].id);
  await command(b, 'room:leave', { roomId: room.id }); await left;
  assert.equal((await command(a, 'room:participants', { roomId: room.id })).participants.length, 1);
  console.log('PASS: saída emitida e snapshot atualizado.');
  if (process.env.DEMO_STATE_PATH) {
    await writeFile(process.env.DEMO_STATE_PATH, JSON.stringify({ room, users }, null, 2), { mode: 0o600 });
  }
  console.log(`Demo aprovada. Sala persistida: ${room.id}. Contas sintéticas: ${users.map((u) => u.nickname).join(', ')}.`);
  console.log('Tokens e senhas não são exibidos. Esta execução cria dados sintéticos e não os apaga.');
} catch (error) {
  console.error(`Demo falhou: ${error.message}`); process.exitCode = 1;
} finally {
  waiting.forEach((w) => w.cancel()); sockets.forEach((s) => s.disconnect());
}
