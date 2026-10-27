const fs=require('fs');const vm=require('vm');const crypto=require('crypto');const assert=require('node:assert/strict');
class FakeRange{constructor(sh,row,col,n,m){Object.assign(this,{sh,row,col,n,m});}getValues(){return Array.from({length:this.n},(_,i)=>Array.from({length:this.m},(_,j)=>this.sh.data[this.row+i-1]?.[this.col+j-1]??''));}setValues(v){v.forEach((row,i)=>row.forEach((value,j)=>{const r=this.row+i-1,c=this.col+j-1;this.sh.data[r]??=[];this.sh.data[r][c]=value;}));return this;}setBackground(){return this;}setFontColor(){return this;}setFontWeight(){return this;}setNumberFormat(){return this;}}
class FakeSheet{constructor(){this.data=[];}getLastRow(){return this.data.length;}getMaxRows(){return Math.max(this.data.length,1000);}getRange(row,col,n=1,m=1){return new FakeRange(this,row,col,n,m);}setFrozenRows(){}appendRow(r){this.data.push(r);}}
class FakeBook{constructor(){this.sheets={};}getSheetByName(n){return this.sheets[n]||null;}insertSheet(n){return this.sheets[n]=new FakeSheet();}}
const book=new FakeBook(), props={ADMIN_NOME:'Admin Teste',ADMIN_LOGIN:'admin.teste',ADMIN_SENHA_INICIAL:'SenhaInicial!2026'},cache={};
const p={getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v},deleteProperty:k=>{delete props[k]}};
const ctxt={Date,console, SpreadsheetApp:{getActiveSpreadsheet:()=>book,flush:()=>{}},PropertiesService:{getScriptProperties:()=>p},Utilities:{getUuid:()=>crypto.randomUUID(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeHmacSha256Signature:(text,key)=>[...crypto.createHmac('sha256',String(key)).update(String(text)).digest()],formatDate:()=> '2026-10-27'},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CacheService:{getScriptCache:()=>({get:key=>cache[key]||null,put:(k,v)=>{cache[k]=v},remove:k=>{delete cache[k]}})}};
vm.createContext(ctxt);vm.runInContext(fs.readFileSync(__dirname+'/../Code.gs','utf8'),ctxt);
function api(action,token='',data={}){return ctxt.api(action,token,data);}
function safe(fn){try{fn();return false}catch(e){return true;}}
function asRole(userPass,userLogin){return api('login','',{login:userLogin,password:userPass}).token;}
assert.match(ctxt.instalarSistema(),/instalado/);assert.ok(!props.ADMIN_SENHA_INICIAL);
const admin=asRole('SenhaInicial!2026','admin.teste');assert.ok(safe(()=>api('snapshot',admin,{})),'Inicialização exige troca');
api('changePassword',admin,{current:'SenhaInicial!2026',next:'SenhaNova!2026'});
let snap=api('snapshot',admin,{});assert.equal(snap.user.perfil,'secretaria');
const yy=snap.year;
const school=api('save',admin,{type:'school',item:{nome:'Escola Teste'}}).id;
const cls=api('save',admin,{type:'class',year:yy,item:{ano:yy,escolaId:school,nome:'Turma 3º ano'}}).id;
const rt=api('save',admin,{type:'route',year:yy,item:{ano:yy,escolaId:school,nome:'Rota 01'}}).id;
const pt=api('save',admin,{type:'stop',item:{rotaId:rt,nome:'Ponto 01',ordem:1}}).id;
const st=api('save',admin,{type:'student',year:yy,item:{ano:yy,escolaId:school,turmaId:cls,nome:'Estudante Fictício',rotaId:rt,pontoId:pt,responsavel:'Responsável fictício',celular:'(38) 99999-0000'}}).id;
const pending=api('save',admin,{type:'student',year:yy,item:{ano:yy,escolaId:school,turmaId:cls,nome:'Estudante Pendente',responsavel:'Responsável fictício'}}).id;
const monitor=api('createUser',admin,{item:{nome:'Monitor Teste',login:'monitor.teste',perfil:'monitor',password:'Monitor!Senha2026'}}).id;
const schoolUser=api('createUser',admin,{item:{nome:'Escola Teste',login:'escola.teste',perfil:'escola',escolaId:school,password:'Escola!Senha2026'}}).id;
api('setAssignments',admin,{userId:monitor,year:yy,routeIds:[rt]});
const monToken=asRole('Monitor!Senha2026','monitor.teste');
api('changePassword',monToken,{current:'Monitor!Senha2026',next:'SenhaDoMonitor!Nova2026'});
const monData=api('snapshot',monToken,{});
assert.equal(monData.students.length,2);
assert.ok(!monData.students.find(x=>x.id===st).qrToken,'monitor não recebe token QR');
assert.equal(monData.students.find(x=>x.id===pending).celular,'','estudante pendente não mostra celular');
assert.ok(safe(()=>api('save',monToken,{type:'school',item:{nome:'Outra'}})));
assert.ok(safe(()=>api('createUser',monToken,{item:{nome:'Outro'}})));
assert.ok(safe(()=>api('attendance',monToken,{day:'2026-10-27',sentido:'IDA',status:'PRESENTE',studentId:pending,routeId:rt})),'estudante sem rota não entra na chamada');
api('save',monToken,{type:'student',item:{id:pending,rotaId:rt,pontoId:pt}});
assert.ok(safe(()=>api('save',monToken,{type:'student',item:{id:pending,rotaId:'rota-falsa',pontoId:pt}})));
const qr=api('snapshot',admin,{}).students.find(x=>x.id===st).qrToken;
assert.equal(api('attendance',monToken,{day:'2026-10-27',sentido:'IDA',status:'PRESENTE',qr:'TC:'+qr,routeId:rt}).status,'PRESENTE');
assert.ok(safe(()=>api('attendance',monToken,{day:'2026-10-27',sentido:'IDA',status:'PRESENTE',qr:'TC:'+qr,routeId:rt})),'repetição rejeitada');

// O mesmo estudante embarca na Ida e na Volta do mesmo dia. Devem gerar dois lançamentos independentes.
const returnTrip=api('attendance',monToken,{day:'2026-10-27',sentido:'VOLTA',status:'PRESENTE',qr:'TC:'+qr,routeId:rt});
assert.equal(returnTrip.sentido,'VOLTA');
const outboundTrip=api('snapshot',monToken,{day:'2026-10-27'}).calls.find(x=>x.estudanteId===st&&x.sentido==='IDA');
const homeboundTrip=api('snapshot',monToken,{day:'2026-10-27'}).calls.find(x=>x.estudanteId===st&&x.sentido==='VOLTA');
assert.ok(outboundTrip&&homeboundTrip,'ida e volta devem existir');
assert.notEqual(outboundTrip.id,homeboundTrip.id,'ida e volta não podem compartilhar o mesmo registro');
assert.equal(outboundTrip.status,'PRESENTE');
assert.equal(homeboundTrip.status,'PRESENTE');
assert.ok(outboundTrip.registradoEm&&homeboundTrip.registradoEm,'data e hora devem ser salvas');
assert.equal(outboundTrip.usuarioId,monitor,'o monitor responsável deve ser registrado');
// Corrigir somente a volta, preservando o registro da ida.
api('attendance',monToken,{day:'2026-10-27',sentido:'VOLTA',status:'AUSENTE',studentId:st,routeId:rt});
const separate=api('snapshot',monToken,{day:'2026-10-27'}).calls.filter(x=>x.estudanteId===st);
assert.equal(separate.find(x=>x.sentido==='IDA').status,'PRESENTE');
assert.equal(separate.find(x=>x.sentido==='VOLTA').status,'AUSENTE');

assert.ok(safe(()=>api('attendance',monToken,{day:'2026-10-27',sentido:'IDA',status:'PRESENTE',qr:'TC:'+qr,routeId:'outra rota'})),'rota diferente rejeitada');
const schoolToken=asRole('Escola!Senha2026','escola.teste');api('changePassword',schoolToken,{current:'Escola!Senha2026',next:'NovaSenhaEscola!2026'});
assert.equal(api('snapshot',schoolToken,{}).students.length,2);
assert.ok(safe(()=>api('attendance',schoolToken,{day:'2026-10-27',sentido:'IDA',status:'AUSENTE',studentId:st,routeId:rt})),'escola não faz chamada');
api('createYear',admin,{year:'2027'});
const newYear=api('snapshot',admin,{year:'2027'});assert.equal(newYear.students.length,0);
api('setAssignments',admin,{userId:monitor,year:'2027',routeIds:[]});
assert.equal(api('snapshot',monToken,{year:yy}).routes.length,1,'atribuição do ano anterior preservada');
api('logout',monToken);assert.ok(safe(()=>api('snapshot',monToken,{})),'logout invalida sessão');
console.log('PASS: setup, senhas, cadastros, escopos, QR, ida/volta independentes, horários, duplicação, logout.');
