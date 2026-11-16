import 'dotenv/config';
import { beforeAll, afterAll, afterEach, it, expect, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import { createRequire } from 'node:module';
import { gerarCpfTeste } from './helpers/gerarCpfTeste.mjs';
const require=createRequire(import.meta.url);
const User=require('../src/models/User');
const Session=require('../src/models/session');
const Event=require('../src/models/adminEvent');
const change=require('../src/services/emailChangeService');
const auth=require('../src/services/authService');
const mail=require('../src/services/emailService');
const {gerarHashSenha}=require('../src/services/passwordService');
const app=require('../src/app');
const ids=[];
let hash;
async function user(data={}) { const u=await User.create({nome:'Cliente teste',email:`change-${new mongoose.Types.ObjectId()}@example.com`,senhaHash:hash,emailVerificado:true,...data});ids.push(u._id);return u; }
async function send(u,email=`novo-${new mongoose.Types.ObjectId()}@example.com`) {const mock=vi.spyOn(mail,'enviarLinkAlteracaoEmail').mockResolvedValue({});await change.solicitar(u.id,{email,senhaAtual:'senha-teste'});return {email,token:new URLSearchParams(new URL(mock.mock.calls.at(-1)[1]).hash.slice(1)).get('token'),mock};}
beforeAll(async()=>{
 const url=new URL(process.env.MONGODB_TEST_URI);
 if(url.hostname!=='127.0.0.1'||url.pathname!=='/clube_planner_test')throw Error('Banco não autorizado');
 await mongoose.connect(url.toString());await Promise.all([User.init(),Session.init(),Event.init()]);hash=await gerarHashSenha('senha-teste');
});
afterEach(async()=>{vi.restoreAllMocks();await Promise.all([User.deleteMany({_id:{$in:ids}}),Session.deleteMany({userId:{$in:ids}}),Event.deleteMany({actorId:{$in:ids}})]);ids.length=0;});
afterAll(async()=>{await mongoose.disconnect();});
it('mantém o e-mail oficial até confirmar, preserva identidade e invalida sessões e token',async()=>{
 const u=await user({role:'admin'});const {email,token}=await send(u);
 let saved=await User.findById(u.id).select('+alteracaoEmail.tokenHash');
 expect(saved.email).toBe(u.email);expect(saved.alteracaoEmail.tokenHash).not.toBe(token);
 const login=await request(app).post('/api/v1/auth/login').set('Origin',process.env.FRONTEND_URL).send({email:u.email,senha:'senha-teste'});
 expect(login.status).toBe(200);
 const result=await change.confirmar(token);expect(result.usuarioId).toBe(u.id);
 saved=await User.findById(u.id);expect(saved.email).toBe(email);expect(saved.role).toBe('admin');expect(saved.credencialVersao).toBe(1);
 expect(await Session.countDocuments({userId:u._id,revokedAt:null})).toBe(0);
 await expect(change.confirmar(token)).rejects.toMatchObject({statusCode:400});
 const novo=await request(app).post('/api/v1/auth/login').set('Origin',process.env.FRONTEND_URL).send({email,senha:'senha-teste'});expect(novo.status).toBe(200);
});
it('impede troca sem senha e duplicidade ativa, sem enviar mensagens',async()=>{
 const u=await user(),outro=await user();const spy=vi.spyOn(mail,'enviarLinkAlteracaoEmail').mockResolvedValue({});
 await expect(change.solicitar(u.id,{email:outro.email,senhaAtual:'errada'})).rejects.toThrow('Senha atual');
 await expect(change.solicitar(u.id,{email:outro.email,senhaAtual:'senha-teste'})).rejects.toThrow('conta ativa');expect(spy).not.toHaveBeenCalled();
});
it('envia uma única mensagem em solicitações simultâneas',async()=>{
 const u=await user();const spy=vi.spyOn(mail,'enviarLinkAlteracaoEmail').mockResolvedValue({});
 const results=await Promise.allSettled([1,2].map(()=>change.solicitar(u.id,{email:'novo-unico@example.com',senhaAtual:'senha-teste'})));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(spy).toHaveBeenCalledTimes(1);
});
it('falha de SMTP não altera e-mail nem mantém token de alteração',async()=>{
 const u=await user();vi.spyOn(mail,'enviarLinkAlteracaoEmail').mockRejectedValue(Error('SMTP'));
 await expect(change.solicitar(u.id,{email:'falha@example.com',senhaAtual:'senha-teste'})).rejects.toThrow('Não foi possível enviar');
 const saved=await User.findById(u.id).select('+alteracaoEmail.tokenHash');expect(saved.email).toBe(u.email);expect(saved.alteracaoEmail.tokenHash).toBeNull();
});
it('cancelamento, expiração e mudança de credencial invalidam a confirmação',async()=>{
 for(const modo of ['cancelar','expirar','credencial']) {
 const u=await user();const {token}=await send(u);
 if(modo==='cancelar')await change.cancelar(u.id);
 else await User.updateOne({_id:u._id},modo==='expirar'?{$set:{'alteracaoEmail.expiraEm':new Date(0)}}:{$inc:{credencialVersao:1}});
 await expect(change.confirmar(token)).rejects.toThrow('Link inválido');expect((await User.findById(u.id)).email).toBe(u.email);
 }
});
it('conflito na confirmação preserva o e-mail anterior; confirmação concorrente só ocorre uma vez',async()=>{
 const u=await user();let pending=await send(u);await user({email:pending.email});
 await expect(change.confirmar(pending.token)).rejects.toThrow('preservado');expect((await User.findById(u.id)).email).toBe(u.email);
 const v=await user();pending=await send(v);const results=await Promise.allSettled([change.confirmar(pending.token),change.confirmar(pending.token)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
});
it('CPF é editável, normalizado e único; falha não salva parcialmente o nome',async()=>{
 const u=await user(),outro=await user({cpf:gerarCpfTeste()});const cpf=gerarCpfTeste();
 expect((await auth.atualizarDadosPessoais(u.id,{cpf})).cpf).toBe(cpf);
 await expect(auth.atualizarDadosPessoais(u.id,{cpf:'11111111111'})).rejects.toThrow('CPF inválido');
 await expect(auth.atualizarDadosPessoais(u.id,{nome:'Outro nome',cpf:outro.cpf})).rejects.toThrow('outra conta ativa');
 expect((await User.findById(u.id)).nome).toBe(u.nome);
 await expect(auth.atualizarDadosPessoais(u.id,{email:'direto@example.com'})).rejects.toThrow('confirmação');
});
it('unicidade resiste à concorrência e reativação após recadastro',async()=>{
 const old=await user({ativo:false,cpf:gerarCpfTeste()});const novo=await user({email:old.email,cpf:old.cpf});expect(novo.id).not.toBe(old.id);
 await expect(User.updateOne({_id:old._id},{$set:{ativo:true}})).rejects.toMatchObject({code:11000});
 const a=await user(),b=await user(),cpf=gerarCpfTeste();const results=await Promise.allSettled([a,b].map(u=>auth.atualizarDadosPessoais(u.id,{cpf})));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
});
it('rotas exigem autenticação e o painel só recebe o novo e-mail depois da confirmação',async()=>{
 const u=await user({cpf:gerarCpfTeste()});
 const denied=await request(app).post('/api/v1/auth/me/email-change').set('Origin',process.env.FRONTEND_URL).send({email:'novo@example.com',senhaAtual:'senha-teste'});expect(denied.status).toBe(401);
 const login=await request(app).post('/api/v1/auth/login').set('Origin',process.env.FRONTEND_URL).send({email:u.email,senha:'senha-teste'});
 const access=login.body.data.accessToken;
 const mock=vi.spyOn(mail,'enviarLinkAlteracaoEmail').mockResolvedValue({});const email=`http-${new mongoose.Types.ObjectId()}@example.com`;
 const response=await request(app).post('/api/v1/auth/me/email-change').set('Authorization',`Bearer ${access}`).set('Origin',process.env.FRONTEND_URL).send({email,senhaAtual:'senha-teste'});expect(response.status).toBe(200);
 const token=new URLSearchParams(new URL(mock.mock.calls[0][1]).hash.slice(1)).get('token');
 const admin=require('../src/services/adminService');
 let clientes=await admin.listarClientes({busca:u.email});expect(clientes.clientes.find(c=>c.id===u.id)).toMatchObject({email:u.email,cpf:u.cpf});
 const profile=await request(app).get('/api/v1/auth/me').set('Authorization',`Bearer ${access}`);expect(profile.body.data.usuario.emailPendente).toBe(email);
 const confirmed=await request(app).post('/api/v1/auth/confirm-email-change').set('Origin',process.env.FRONTEND_URL).send({token});expect(confirmed.status).toBe(200);
 clientes=await admin.listarClientes({busca:email});expect(clientes.clientes.find(c=>c.id===u.id)).toMatchObject({email,cpf:u.cpf});
 const oldSession=await request(app).get('/api/v1/auth/me').set('Authorization',`Bearer ${access}`);expect(oldSession.status).toBe(401);
});
