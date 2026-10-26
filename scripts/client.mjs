import { createInterface } from 'node:readline/promises';
import { connect, command } from './socket-tools.mjs';
const token = process.env.LOBBY_TOKEN;
if (!token) { console.error('Defina LOBBY_TOKEN no ambiente, sem passá-lo como argumento. Veja docs/EVENTS.md.'); process.exit(1); }
const socket = await connect(process.env.LOBBY_URL ?? 'http://127.0.0.1:3002', token);
for (const name of ['participant:joined', 'participant:left', 'room:participants', 'chat:message', 'operation:error']) {
  socket.on(name, (payload) => console.log(name, JSON.stringify(payload)));
}
const terminal = createInterface({ input: process.stdin, output: process.stdout });
socket.on('disconnect', (reason) => { console.log('Desconectado:', reason); terminal.close(); });
console.log('Comandos: /join UUID | /leave UUID | /participants UUID | /say UUID texto | /quit');
try {
  for await (const line of terminal) {
    const [action, roomId, ...text] = line.trim().split(/\s+/);
    if (action === '/quit') break;
    const events = { '/join': 'room:join', '/leave': 'room:leave', '/participants': 'room:participants', '/say': 'chat:send' };
    const event = events[action];
    if (!event || !roomId) { console.log('Comando inválido.'); continue; }
    try { console.log(JSON.stringify(await command(socket, event, { roomId, ...(action === '/say' ? { text: text.join(' ') } : {}) }))); }
    catch (error) { console.error(error.message); }
  }
} finally { terminal.close(); socket.disconnect(); }
