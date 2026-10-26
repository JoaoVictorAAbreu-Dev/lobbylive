import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { MikroORM } from '@mikro-orm/postgresql';
import * as argon2 from 'argon2';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import { setupApp } from '../src/setup-app.js';
import { PresenceService } from '../src/realtime/presence.service.js';
import type { ChatMessage, ParticipantChange, Result, RoomSnapshot } from '../src/realtime/contracts.js';

const testDb = process.env.TEST_DB_NAME ?? 'lobbylive_test';
if (!/^[a-z][a-z0-9_]*_test$/.test(testDb)) throw new Error('TEST_DB_NAME deve terminar em _test.');
process.env.DB_NAME = testDb;
process.env.JWT_SECRET = randomBytes(48).toString('base64url');
const password = 'Synthetic-test-password-123!';
let app: INestApplication;
let orm: MikroORM;
let jwt: JwtService;
let base: string;
let passwordHash: string;
let users: { id: string; nickname: string; token: string }[];
let sockets: Socket[] = [];
let roomIds: string[] = [];
const api = () => request(app.getHttpServer());
const root = '/api/v1';
function authenticated(method: 'get' | 'post', path: string, actor = 0) {
  return api()[method](`${root}${path}`).auth(users[actor].token, { type: 'bearer' });
}
async function room(capacity = 8) {
  const response = await authenticated('post', '/rooms').send({ name: 'Test lobby', capacity }).expect(201);
  roomIds.push(response.body.id);
  return response.body as { id: string; capacity: number; participantCount: number };
}
async function connect(token = users[0].token): Promise<Socket> {
  const socket = io(`${base}/lobby`, { auth: { token }, transports: ['websocket'], forceNew: true,
    autoConnect: false, reconnection: false, timeout: 4000 });
  sockets.push(socket);
  const connected = new Promise<Socket>((resolve, reject) => {
    socket.once('connect', () => resolve(socket)); socket.once('connect_error', reject);
  });
  socket.connect();
  return connected;
}
function event<T>(socket: Socket, name: string, predicate: (value: T) => boolean = () => true, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); socket.off(name, listener); };
    const listener = (value: T) => { if (predicate(value)) { cleanup(); resolve(value); } };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timeout: ${name}`)); }, timeout);
    socket.on(name, listener);
  });
}
function command<T = RoomSnapshot>(socket: Socket, name: string, payload: unknown): Promise<Result<T>> {
  return new Promise((resolve, reject) => socket.timeout(5000).emit(name, payload,
    (error: Error | null, response: Result<T>) => error ? reject(error) : resolve(response)));
}
async function success<T = RoomSnapshot>(socket: Socket, name: string, payload: unknown): Promise<T> {
  const result = await command<T>(socket, name, payload);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result.data;
}
async function eventually(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 4000;
  while (!predicate()) { if (Date.now() >= deadline) throw new Error('Condition timed out'); await pause(10); }
}

beforeAll(async () => {
  const { default: config } = await import('../src/mikro-orm.config.js');
  const migrationOrm = await MikroORM.init({ ...config, dbName: testDb });
  try { await migrationOrm.migrator.up(); await migrationOrm.migrator.up(); }
  finally { await migrationOrm.close(true); }
  const { AppModule } = await import('../src/app.module.js');
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = module.createNestApplication();
  setupApp(app);
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl(); orm = app.get(MikroORM); jwt = app.get(JwtService);
  passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
});
beforeEach(async () => {
  if (orm.config.get('dbName') !== testDb) throw new Error('Base inesperada; limpeza abortada.');
  await orm.em.getConnection().execute('truncate table rooms, users');
  users = [];
  for (const nickname of ['alpha', 'bravo', 'charlie']) {
    const id = randomUUID();
    await orm.em.getConnection().execute('insert into users (id,nickname,password_hash,created_at) values (?,?,?,now())', [id,nickname,passwordHash]);
    users.push({ id, nickname, token: await jwt.signAsync({ sub: id }) });
  }
});
afterEach(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await eventually(() => roomIds.every((id) => app.get(PresenceService).snapshot(id).participants.length === 0));
  sockets = []; roomIds = [];
});
afterAll(async () => { if (app) await app.close(); });

describe('REST, autenticação e persistência', () => {
  it('cadastra, normaliza e armazena Argon2id sem expor o hash', async () => {
    const response = await api().post(`${root}/auth/register`).send({ nickname: ' New_USER ', password }).expect(201);
    expect(response.body).toMatchObject({ nickname: 'new_user' });
    expect(Object.keys(response.body).sort()).toEqual(['createdAt','id','nickname']);
    const rows = await orm.em.getConnection().execute<{password_hash: string}[]>('select password_hash from users where id=?',[response.body.id]);
    expect(rows[0].password_hash).toMatch(/^\$argon2id\$/);
    expect(await argon2.verify(rows[0].password_hash,password)).toBe(true);
  });
  it('login e me usam JWT de uma hora, emissor e audiência definidos', async () => {
    const response = await api().post(`${root}/auth/login`).send({ nickname: 'ALPHA', password }).expect(200);
    expect(response.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    const claims = await jwt.verifyAsync(response.body.accessToken);
    expect(claims).toMatchObject({ sub: users[0].id, iss: 'lobbylive', aud: 'lobbylive' });
    expect(claims.exp - claims.iat).toBe(3600);
    const me = await api().get(`${root}/auth/me`).auth(response.body.accessToken,{type:'bearer'}).expect(200);
    expect(me.body.nickname).toBe('alpha'); expect(me.body.passwordHash).toBeUndefined();
  });
  it('login incorreto e usuário ausente têm a mesma resposta', async () => {
    const first = await api().post(`${root}/auth/login`).send({nickname:'alpha',password:'Incorrect-password-123'}).expect(401);
    const second = await api().post(`${root}/auth/login`).send({nickname:'missing',password}).expect(401);
    expect(first.body).toEqual(second.body); expect(first.body.code).toBe('INVALID_CREDENTIALS');
  });
  it('unicidade de nickname também vale em cadastro concorrente', async () => {
    const responses = await Promise.all([1,2].map(()=>api().post(`${root}/auth/register`).send({nickname:'race_user',password})));
    expect(responses.map((r)=>r.status).sort()).toEqual([201,409]);
  });
  it.each([{nickname:'ab',password},{nickname:'álpha',password},{nickname:'valid',password:'short'},
    {nickname:'valid',password:'x'.repeat(129)},{nickname:'valid',password,role:'admin'}])('rejeita cadastro inválido %j',async(body)=>{
      expect((await api().post(`${root}/auth/register`).send(body).expect(400)).body.code).toBe('VALIDATION_ERROR');
    });
  it('protege todos os endpoints de salas e me sem JWT válido',async()=>{
    for(const path of ['/rooms','/rooms/'+randomUUID(),'/auth/me']) await api().get(root+path).expect(401);
    await api().post(`${root}/rooms`).send({name:'Lobby'}).expect(401);
    await api().get(`${root}/rooms`).auth('invalid',{type:'bearer'}).expect(401);
    const expired=await jwt.signAsync({sub:users[0].id},{expiresIn:-1});
    await api().get(`${root}/rooms`).auth(expired,{type:'bearer'}).expect(401);
  });
  it('cria salas, aplica capacidade padrão e pagina sem expor senha',async()=>{
    const response=await authenticated('post','/rooms').send({name:'  Nova sala  '}).expect(201);
    roomIds.push(response.body.id);
    expect(response.body).toMatchObject({name:'Nova sala',capacity:8,participantCount:0,creator:{id:users[0].id,nickname:'alpha'}});
    await room(2);
    const page=(await authenticated('get','/rooms?page=2&limit=1').expect(200)).body;
    expect(page).toMatchObject({total:2,page:2,limit:1});expect(page.data).toHaveLength(1);
    expect((await authenticated('get',`/rooms/${response.body.id}`).expect(200)).body).toEqual(response.body);
    expect(JSON.stringify(page)).not.toContain('password');
    await authenticated('get','/rooms?limit=101').expect(400);
    await authenticated('get','/rooms/invalid').expect(400);
    await authenticated('get','/rooms/'+randomUUID()).expect(404);
  });
  it.each([{name:'ab'},{name:'x'.repeat(61)},{name:'Lobby',capacity:1},{name:'Lobby',capacity:17},
    {name:'Lobby',capacity:null},{name:'Lobby',capacity:'8'},{name:'Lobby',ownerId:'spoofed'}])('rejeita sala inválida %j',async(body)=>{
      await authenticated('post','/rooms').send(body).expect(400);
    });
  it('migrations reaplicáveis e schema alinhado',async()=>{
    await orm.migrator.up();expect(await orm.migrator.getPending()).toHaveLength(0);
    expect((await orm.schema.getUpdateSchemaSQL()).trim()).toBe('');
  });
  it('health consulta banco real e Swagger contém segurança Bearer',async()=>{
    expect((await api().get(`${root}/health`).expect(200)).body).toEqual({status:'ok',database:'up'});
    const doc=(await api().get('/docs-json').expect(200)).body;
    expect(doc.components.securitySchemes.bearer).toMatchObject({type:'http',scheme:'bearer'});
    for(const path of ['/auth/register','/auth/login','/auth/me','/rooms','/rooms/{id}','/health']) expect(doc.paths[root+path]).toBeDefined();
    await api().get('/docs/').expect(200);
  });
});

describe('Socket.IO real: presença, chat e isolamento',()=>{
  it('dois usuários entram, veem snapshot, trocam mensagem e observam saída',async()=>{
    const r=await room();const a=await connect();const b=await connect(users[1].token);
    expect((await success(a,'room:join',{roomId:r.id})).participants).toHaveLength(1);
    const entered=event<ParticipantChange>(a,'participant:joined',v=>v.participant.userId===users[1].id);
    expect((await success(b,'room:join',{roomId:r.id})).participants).toHaveLength(2);
    expect((await entered).roomId).toBe(r.id);
    const messageA=event<ChatMessage>(a,'chat:message'); const messageB=event<ChatMessage>(b,'chat:message');
    const sent=await success<ChatMessage>(a,'chat:send',{roomId:r.id,text:'  Olá sala  '});
    expect(sent).toMatchObject({roomId:r.id,text:'Olá sala',sender:{userId:users[0].id,nickname:'alpha'}});
    expect(await messageA).toEqual(sent);expect(await messageB).toEqual(sent);
    const left=event<ParticipantChange>(a,'participant:left');await success(b,'room:leave',{roomId:r.id});
    expect((await left).participant.userId).toBe(users[1].id);
    expect((await success(a,'room:participants',{roomId:r.id})).participants).toHaveLength(1);
  });
  it('duas conexões da mesma conta ocupam uma vaga; apenas a última saída emite evento',async()=>{
    const r=await room(2);const a1=await connect();const a2=await connect();const b=await connect(users[1].token);
    await success(a1,'room:join',{roomId:r.id});await success(b,'room:join',{roomId:r.id});
    let joined=0;let left=0;b.on('participant:joined',()=>joined++);b.on('participant:left',()=>left++);
    expect((await success(a2,'room:join',{roomId:r.id})).participants).toHaveLength(2);
    await success(a1,'room:leave',{roomId:r.id});await success(a1,'room:leave',{roomId:r.id});
    expect((await success(b,'room:participants',{roomId:r.id})).participants).toHaveLength(2);
    expect(joined).toBe(0);expect(left).toBe(0);
    const final=event<ParticipantChange>(b,'participant:left');a2.disconnect();await final;expect(left).toBe(1);
  });
  it('entrada repetida não duplica eventos nem participantes',async()=>{
    const r=await room();const a=await connect();let joined=0;a.on('participant:joined',()=>joined++);
    await success(a,'room:join',{roomId:r.id});await success(a,'room:join',{roomId:r.id});
    expect((await success(a,'room:participants',{roomId:r.id})).participants).toHaveLength(1);expect(joined).toBe(1);
  });
  it('concorrência pela última vaga aceita apenas uma conta',async()=>{
    const r=await room(2);const a=await connect();const b=await connect(users[1].token);const c=await connect(users[2].token);
    await success(a,'room:join',{roomId:r.id});
    const results=await Promise.all([command(b,'room:join',{roomId:r.id}),command(c,'room:join',{roomId:r.id})]);
    expect(results.filter(v=>v.ok)).toHaveLength(1);
    expect(results.find(v=>!v.ok)).toMatchObject({ok:false,error:{code:'ROOM_FULL'}});
    expect((await success(a,'room:participants',{roomId:r.id})).participants).toHaveLength(2);
  });
  it('suporta várias salas e desconexão limpa todas as participações',async()=>{
    const one=await room();const two=await room();const a=await connect();const b=await connect(users[1].token);
    for(const id of [one.id,two.id]) {await success(a,'room:join',{roomId:id});await success(b,'room:join',{roomId:id});}
    const leftOne=event<ParticipantChange>(b,'participant:left',v=>v.roomId===one.id);
    const leftTwo=event<ParticipantChange>(b,'participant:left',v=>v.roomId===two.id);a.disconnect();
    await Promise.all([leftOne,leftTwo]);
    for(const id of [one.id,two.id]) expect((await success(b,'room:participants',{roomId:id})).participants).toHaveLength(1);
  });
  it('uma sala diferente não recebe chat nem eventos de presença',async()=>{
    const one=await room();const two=await room();const a=await connect();const b=await connect(users[1].token);const c=await connect(users[2].token);
    await success(a,'room:join',{roomId:one.id});await success(c,'room:join',{roomId:two.id});
    const leaks:unknown[]=[];
    for(const name of ['chat:message','participant:joined','participant:left','room:participants']) c.on(name,v=>leaks.push(v));
    await success(b,'room:join',{roomId:one.id});await success(a,'chat:send',{roomId:one.id,text:'Only room one'});
    await success(b,'room:leave',{roomId:one.id});await pause(150);expect(leaks).toEqual([]);
  });
  it('não membro não consulta participantes nem envia mensagem; campos de identidade são rejeitados',async()=>{
    const r=await room();const a=await connect();
    expect(await success(a,'room:leave',{roomId:r.id})).toEqual({roomId:r.id,left:false});
    for(const name of ['room:participants','chat:send']) expect(await command(a,name,{roomId:r.id,...(name==='chat:send'?{text:'hello'}:{})})).toMatchObject({ok:false,error:{code:'NOT_IN_ROOM'}});
    await success(a,'room:join',{roomId:r.id});
    for(const payload of [{roomId:r.id,text:'hello',sender:{userId:users[1].id}},{roomId:r.id,text:''},{roomId:r.id,text:'x'.repeat(501)},null,[]]) {
      expect(await command(a,'chat:send',payload)).toMatchObject({ok:false,error:{code:'VALIDATION_ERROR'}});
    }
  });
  it('trata sala ausente, UUID inválido e erro sem callback',async()=>{
    const a=await connect();expect(await command(a,'room:join',{roomId:randomUUID()})).toMatchObject({ok:false,error:{code:'ROOM_NOT_FOUND'}});
    expect(await command(a,'room:join',{roomId:'invalid'})).toMatchObject({ok:false,error:{code:'VALIDATION_ERROR'}});
    const failure=event<{code:string}>(a,'operation:error');a.emit('room:join',{roomId:'invalid'});
    expect((await failure).code).toBe('VALIDATION_ERROR');
  });
  it('handshake rejeita token ausente, inválido, expirado e audiência errada',async()=>{
    const expired=await jwt.signAsync({sub:users[0].id},{expiresIn:-1});
    const wrongAudience=await jwt.signAsync({sub:users[0].id},{audience:'other'});
    for(const token of ['', 'invalid', expired, wrongAudience]) await expect(connect(token)).rejects.toMatchObject({message:'Autenticação obrigatória.'});
  });
  it('token expira durante a sessão e remove a conta das salas',async()=>{
    const r=await room();const short=await jwt.signAsync({sub:users[0].id},{expiresIn:3});
    const a=await connect(short);const b=await connect(users[1].token);
    await success(a,'room:join',{roomId:r.id});await success(b,'room:join',{roomId:r.id});
    const left=event<ParticipantChange>(b,'participant:left',v=>v.participant.userId===users[0].id,6000);
    const disconnected=event<string>(a,'disconnect',()=>true,6000);
    await Promise.all([left,disconnected]);
    expect((await success(b,'room:participants',{roomId:r.id})).participants).toHaveLength(1);
  });
  it('reconexão precisa entrar novamente e não recebe replay do chat',async()=>{
    const r=await room();const a=await connect();const b=await connect(users[1].token);
    await success(a,'room:join',{roomId:r.id});await success(b,'room:join',{roomId:r.id});
    const left=event<ParticipantChange>(b,'participant:left');a.disconnect();await left;
    await success(b,'chat:send',{roomId:r.id,text:'Missed message'});
    const again=await connect();const messages:unknown[]=[];again.on('chat:message',v=>messages.push(v));
    expect(await command(again,'room:participants',{roomId:r.id})).toMatchObject({ok:false,error:{code:'NOT_IN_ROOM'}});
    await success(again,'room:join',{roomId:r.id});await pause(100);expect(messages).toEqual([]);
  });
  it('REST reflete contas únicas conectadas',async()=>{
    const r=await room();const a=await connect();const a2=await connect();await success(a,'room:join',{roomId:r.id});await success(a2,'room:join',{roomId:r.id});
    expect((await authenticated('get',`/rooms/${r.id}`).expect(200)).body.participantCount).toBe(1);
  });
});
