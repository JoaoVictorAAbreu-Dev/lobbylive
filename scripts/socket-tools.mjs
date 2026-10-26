import { io } from 'socket.io-client';
export function connect(url, token) {
  const socket = io(`${url}/lobby`, { auth: { token }, autoConnect: false, forceNew: true, reconnection: false, transports: ['websocket'], timeout: 5000 });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', () => { socket.disconnect(); reject(new Error('Falha no handshake; verifique servidor e token.')); });
    socket.connect();
  });
}
export function command(socket, name, payload) {
  return new Promise((resolve, reject) => socket.timeout(5000).emit(name, payload, (error, result) => {
    if (error) reject(new Error(`Timeout: ${name}`));
    else if (!result?.ok) reject(new Error(result?.error?.code ?? 'INVALID_RESPONSE'));
    else resolve(result.data);
  }));
}
export function nextEvent(socket, name, predicate = () => true) {
  let timer;
  let listener;
  const cancel = () => { clearTimeout(timer); socket.off(name, listener); };
  const promise = new Promise((resolve, reject) => {
    listener = (value) => { if (predicate(value)) { cancel(); resolve(value); } };
    timer = setTimeout(() => { cancel(); reject(new Error(`Timeout: ${name}`)); }, 5000);
    socket.on(name, listener);
  });
  return { promise, cancel };
}
