import { PresenceService } from './presence.service.js';
import type { Identity } from '../auth/auth.dto.js';
const a: Identity = { userId: 'a', nickname: 'alpha', expiresAt: Date.now() + 60000 };
const b: Identity = { userId: 'b', nickname: 'bravo', expiresAt: Date.now() + 60000 };
const c: Identity = { userId: 'c', nickname: 'charlie', expiresAt: Date.now() + 60000 };
let presence: PresenceService;
beforeEach(() => { presence = new PresenceService(); });
function join(user: Identity, socket: string, room = 'room', capacity = 2) {
  presence.reserve(room, user, socket, capacity); return presence.commit(room, socket);
}
describe('Presença por conta e reservas de vagas', () => {
  it('não mostra reservas antes do commit', () => {
    presence.reserve('room', a, 'a1', 2);
    expect(presence.snapshot('room').participants).toEqual([]);
    expect(presence.commit('room', 'a1')?.joined?.userId).toBe('a');
    expect(presence.has('room', 'a1')).toBe(true);
  });
  it('deduplica duas conexões da mesma conta e preserva joinedAt', () => {
    const first = join(a, 'a1'); expect(join(a, 'a2')).toEqual({});
    expect(presence.snapshot('room').participants).toEqual([first?.joined]);
    expect(presence.remove('room', 'a1').left).toBeUndefined();
    expect(presence.remove('room', 'a2').left?.userId).toBe('a');
  });
  it('entrada e saída repetidas são idempotentes', () => {
    join(a, 'a1'); expect(join(a, 'a1')).toEqual({});
    expect(presence.snapshot('room').participants).toHaveLength(1);
    expect(presence.remove('room', 'a1').left?.userId).toBe('a');
    expect(presence.remove('room', 'a1')).toEqual({ roomId: 'room' });
  });
  it('reserva a última vaga antes de await; terceiro usuário não ultrapassa capacidade', () => {
    join(a, 'a1'); presence.reserve('room', b, 'b1', 2);
    expect(() => presence.reserve('room', c, 'c1', 2)).toThrow('Sala cheia.');
    presence.remove('room', 'b1'); expect(() => join(c, 'c1')).not.toThrow();
  });
  it('permite outra conexão da conta quando a sala está cheia', () => {
    join(a, 'a1'); join(b, 'b1'); expect(() => join(a, 'a2')).not.toThrow();
    expect(presence.snapshot('room').participants).toHaveLength(2);
  });
  it('cancela uma reserva após desconexão sem criar participante fantasma', () => {
    presence.reserve('room', a, 'a1', 2); presence.removeSocket('a1');
    expect(presence.commit('room', 'a1')).toBeNull(); expect(presence.snapshot('room').participants).toEqual([]);
  });
  it('duas reservas da mesma conta: segundo cliente pode confirmar após falha do primeiro', () => {
    presence.reserve('room', a, 'a1', 2); presence.reserve('room', a, 'a2', 2);
    presence.remove('room', 'a1'); expect(presence.commit('room', 'a2')?.joined?.userId).toBe('a');
  });
  it('limpa todas as salas de uma conexão sem afetar outra conexão da conta', () => {
    join(a, 'a1', 'one'); join(a, 'a1', 'two'); join(a, 'a2', 'one');
    const removed = presence.removeSocket('a1');
    expect(removed.find((r) => r.roomId === 'one')?.left).toBeUndefined();
    expect(removed.find((r) => r.roomId === 'two')?.left?.userId).toBe('a');
    expect(presence.snapshot('one').participants).toHaveLength(1);
    expect(presence.snapshot('two').participants).toEqual([]);
  });
  it('snapshots não expõem estruturas mutáveis internas', () => {
    join(a, 'a1'); const snapshot = presence.snapshot('room'); snapshot.participants[0].nickname = 'changed';
    expect(presence.snapshot('room').participants[0].nickname).toBe('alpha');
  });
});
