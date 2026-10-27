/**
 * ROTAS CARBONITA — GOOGLE APPS SCRIPT
 * Fonte oficial: planilha Google privada vinculada a este projeto.
 * Execute instalarSistema() NO EDITOR após definir ADMIN_NOME, ADMIN_LOGIN,
 * ADMIN_SENHA_INICIAL nas Propriedades do script. Não publique essas propriedades.
 * A aplicação pública expõe apenas api(). Funções auxiliares terminam em _.
 */
const DB = {
  ANOS: ['id','ano','ativo','criadoEm'],
  ESCOLAS: ['id','nome','ativo','criadoEm'],
  TURMAS: ['id','ano','escolaId','nome','ativo','criadoEm'],
  ROTAS: ['id','ano','escolaId','nome','descricao','ativo','criadoEm'],
  PONTOS: ['id','rotaId','nome','ordem','ativo','criadoEm'],
  ESTUDANTES: ['id','ano','nome','escolaId','turmaId','rotaId','pontoId','responsavel','celular','qrToken','ativo','criadoEm','atualizadoEm'],
  USUARIOS: ['id','nome','login','perfil','escolaId','salt','hash','trocarSenha','ativo','criadoEm'],
  ATRIBUICOES: ['id','usuarioId','rotaId','ativo'],
  CHAMADAS: ['id','dia','sentido','estudanteId','rotaId','pontoId','status','usuarioId','registradoEm'],
  AUDITORIA: ['id','data','usuarioId','acao','entidade','entidadeId'],
  SESSOES: ['id','digest','usuarioId','expiraEm','criadoEm']
};
const LABELS = {school:'ESCOLAS',class:'TURMAS',route:'ROTAS',stop:'PONTOS',student:'ESTUDANTES'};
const ROLES = ['secretaria','escola','monitor'];
const ACTIVE = 'SIM';

function doGet() {
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('Rotas Carbonita | Transporte Escolar')
    .addMetaTag('viewport','width=device-width, initial-scale=1');
}
function include(filename) {
  if (['Styles','Client','QRCodeVendor'].indexOf(filename) < 0) throw Error('Arquivo inválido.');
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Rodar diretamente no editor após configurar as três Propriedades do script. */
function instalarSistema() {
  const props = PropertiesService.getScriptProperties();
  const name = String(props.getProperty('ADMIN_NOME') || '').trim();
  const login = String(props.getProperty('ADMIN_LOGIN') || '').trim().toLowerCase();
  const pass = String(props.getProperty('ADMIN_SENHA_INICIAL') || '');
  if (!name || !login || !isStrongPassword_(pass)) {
    throw Error('Defina ADMIN_NOME, ADMIN_LOGIN e ADMIN_SENHA_INICIAL (mínimo 12 caracteres) nas Propriedades do script.');
  }
  return locked_(function () {
    initialize_();
    if (rows_('USUARIOS').length) throw Error('Sistema já possui usuários. Instalação não repetida.');
    const user = newUser_({nome:name,login:login,perfil:'secretaria',escolaId:''},pass,true);
    append_('USUARIOS',user);
    props.deleteProperty('ADMIN_SENHA_INICIAL');
    props.deleteProperty('ADMIN_NOME');
    props.deleteProperty('ADMIN_LOGIN');
    audit_('SISTEMA','INSTALAR','USUARIOS',user.id);
    touch_();
    return 'Sistema instalado. Administrador criado: ' + login + '. Alteração de senha exigida no primeiro acesso.';
  });
}

/** Única entrada de ações do navegador. Autorização validada em TODAS as ações. */
function api(action,token,data) {
  action = String(action || ''); data = data && typeof data === 'object' ? data : {};
  if (action === 'login') return login_(data);
  const user = sessionUser_(token);
  if (action === 'logout') return logout_(token);
  if (action === 'changePassword') return changePassword_(user,data);
  if (user.trocarSenha === ACTIVE) throw Error('É necessário alterar sua senha antes de continuar.');
  if (action === 'snapshot') return snapshot_(user,data);
  if (action === 'updates') {
    const version = PropertiesService.getScriptProperties().getProperty('VERSION') || '0';
    return String(data.version || '') === version ? {changed:false,version:version} : {changed:true,...snapshot_(user,data)};
  }
  if (action === 'save') return save_(user,data);
  if (action === 'disable') return disable_(user,data);
  if (action === 'createUser') return createUser_(user,data);
  if (action === 'setAssignments') return setAssignments_(user,data);
  if (action === 'createYear') return createYear_(user,data);
  if (action === 'attendance') return attendance_(user,data);
  throw Error('Ação desconhecida.');
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw Error('Vincule este projeto Apps Script a uma Planilha Google.');
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw Error('Aba ' + name + ' ausente. Execute instalarSistema.');
  return sheet;
}
function initialize_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw Error('Crie o Apps Script a partir de Extensões > Apps Script na planilha.');
  Object.keys(DB).forEach(function(name){
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1,1,1,DB[name].length).setValues([DB[name]]);
      sh.setFrozenRows(1);
      sh.getRange(1,1,1,DB[name].length).setBackground('#17345c').setFontColor('#ffffff').setFontWeight('bold');
      sh.getRange(2,1,Math.max(100,sh.getMaxRows()-1),DB[name].length).setNumberFormat('@');
    } else {
      const headers = sh.getRange(1,1,1,DB[name].length).getValues()[0];
      if (JSON.stringify(headers) !== JSON.stringify(DB[name])) throw Error('Cabeçalhos alterados na aba ' + name + '.');
    }
  });
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('PEPPER')) props.setProperty('PEPPER',Utilities.getUuid()+Utilities.getUuid());
  if (!props.getProperty('VERSION')) props.setProperty('VERSION','1');
  if (!rows_('ANOS').length) append_('ANOS',{id:uuid_(),ano:String(new Date().getFullYear()),ativo:ACTIVE,criadoEm:now_()});
}
function rows_(name) {
  const sh=sheet_(name), last=sh.getLastRow();
  if (last<2) return [];
  const h=DB[name];
  return sh.getRange(2,1,last-1,h.length).getValues().filter(r=>r[0]!=='' && r[0]!==null)
    .map(function(row){const x={};h.forEach((k,i)=>x[k]=String(row[i]===null?'':row[i]));return x;});
}
function append_(name,record){ sheet_(name).appendRow(DB[name].map(k=>sheetCell_(record[k]===undefined?'':record[k]))); }
function replace_(name,record){
  const sh=sheet_(name), ids=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues():[];
  const index=ids.findIndex(x=>String(x[0])===String(record.id));
  if(index<0)throw Error('Registro não encontrado para edição.');
  sh.getRange(index+2,1,1,DB[name].length).setValues([DB[name].map(k=>sheetCell_(record[k]===undefined?'':record[k]))]);
}
function sheetCell_(v){const s=String(v===null?'':v);return /^[=+@\-]/.test(s) ? "'"+s : s;}
function uuid_(){return Utilities.getUuid();}
function now_(){return new Date().toISOString();}
function active_(r){return r.ativo===ACTIVE;}
function byId_(items,id){return items.find(r=>r.id===String(id||''));}
function get_(name,id){return byId_(rows_(name),id);}
function required_(s,label,max){
  s=String(s===undefined?'':s).trim().replace(/\s+/g,' ');
  if (!s || s.length>(max||140) || /[\u0000-\u001f<>]/.test(s)) throw Error('Preencha corretamente: '+label+'.');
  return s;
}
function optional_(s,max){s=String(s||'').trim();if(s.length>(max||250)||/[\u0000-\u001f<>]/.test(s))throw Error('Campo inválido.');return s;}
function locked_(fn) {
  const lock=LockService.getScriptLock();lock.waitLock(18000);
  try {const out=fn();SpreadsheetApp.flush();return out;} finally {lock.releaseLock();}
}
function touch_(){PropertiesService.getScriptProperties().setProperty('VERSION',Date.now()+'-'+Utilities.getUuid().slice(0,7));}
function audit_(actor,action,table,id){append_('AUDITORIA',{id:uuid_(),data:now_(),usuarioId:actor,acao:action,entidade:table,entidadeId:id});}
function assert_(ok,msg){if(!ok)throw Error(msg||'Operação não autorizada.');}
function onlySecret_(user){assert_(user.perfil==='secretaria','Recurso exclusivo da Secretaria.');}
function pepper_(){const p=PropertiesService.getScriptProperties().getProperty('PEPPER');if(!p)throw Error('Sistema não instalado.');return p;}
function digest_(s){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(s),pepper_()));}
function pwdHash_(password,salt){return digest_('PASSWORD:'+salt+':'+password);}
function isStrongPassword_(p){return typeof p==='string' && p.length>=12 && p.length<=128;}
function newUser_(d,pass,force){
  const salt=uuid_()+uuid_();return {id:uuid_(),nome:d.nome,login:d.login,perfil:d.perfil,escolaId:d.escolaId||'',salt:salt,hash:pwdHash_(pass,salt),trocarSenha:force?ACTIVE:'NAO',ativo:ACTIVE,criadoEm:now_()};
}
function publicUser_(u){return {id:u.id,nome:u.nome,login:u.login,perfil:u.perfil,escolaId:u.escolaId,ativo:u.ativo,trocarSenha:u.trocarSenha};}
function login_(d){
  const login=String(d.login||'').trim().toLowerCase(), pass=String(d.password||'');
  if(!/^[a-z0-9._@-]{3,90}$/.test(login)) throw Error('Credenciais inválidas.');
  const cache=CacheService.getScriptCache(),key='BAD_'+digest_(login).slice(0,36);
  if(Number(cache.get(key)||0)>=6) throw Error('Acesso temporariamente bloqueado. Tente novamente em 15 minutos.');
  const u=rows_('USUARIOS').find(x=>x.login===login && active_(x));
  if(!u||pwdHash_(pass,u.salt)!==u.hash){cache.put(key,String(Number(cache.get(key)||0)+1),900);throw Error('Credenciais inválidas.');}
  cache.remove(key);
  return locked_(function(){
    const raw=uuid_().replace(/-/g,'')+uuid_().replace(/-/g,'');
    const expiry=new Date(Date.now()+12*3600*1000).toISOString();
    append_('SESSOES',{id:uuid_(),digest:digest_('SESSION:'+raw),usuarioId:u.id,expiraEm:expiry,criadoEm:now_()});
    return {token:raw,user:publicUser_(u),expiresAt:expiry};
  });
}
function sessionUser_(token){
  assert_(typeof token==='string'&&/^[0-9a-f]{64}$/i.test(token),'Sessão inválida. Faça login novamente.');
  const hash=digest_('SESSION:'+token),ses=rows_('SESSOES').find(s=>s.digest===hash);
  assert_(ses && new Date(ses.expiraEm).getTime()>Date.now(),'Sessão expirada. Faça login novamente.');
  const u=get_('USUARIOS',ses.usuarioId);
  assert_(u && active_(u),'Usuário desativado.');return u;
}
function logout_(token){return locked_(function(){
  const digest=digest_('SESSION:'+String(token||''));
  const s=rows_('SESSOES').find(x=>x.digest===digest);
  if(s){s.expiraEm=now_();replace_('SESSOES',s);}return {ok:true};
});}
function changePassword_(u,d){
  assert_(pwdHash_(String(d.current||''),u.salt)===u.hash,'Senha atual incorreta.');
  assert_(isStrongPassword_(d.next),'A nova senha precisa de 12 a 128 caracteres.');
  assert_(d.current!==d.next,'A senha nova deve ser diferente da anterior.');
  return locked_(function(){const current=get_('USUARIOS',u.id);
    assert_(current&&pwdHash_(String(d.current||''),current.salt)===current.hash,'Senha alterada em outro acesso.');
    current.salt=uuid_()+uuid_();current.hash=pwdHash_(d.next,current.salt);current.trocarSenha='NAO';
    replace_('USUARIOS',current);audit_(u.id,'SENHA','USUARIOS',u.id);touch_();
    return {ok:true,user:publicUser_(current)};
  });
}
function scope_(u,year){
  const schools=rows_('ESCOLAS').filter(active_);
  const routes=rows_('ROTAS').filter(r=>active_(r)&&r.ano===year);
  const asg=rows_('ATRIBUICOES').filter(a=>active_(a)&&a.usuarioId===u.id);
  const monitorRouteIds=asg.map(a=>a.rotaId).filter(id=>routes.some(r=>r.id===id));
  const monitorSchoolIds=routes.filter(r=>monitorRouteIds.includes(r.id)).map(r=>r.escolaId);
  return {schools,routes,monitorRouteIds,monitorSchoolIds};
}
function snapshot_(u,d){
  const years=rows_('ANOS').filter(active_).map(x=>x.ano).sort().reverse();
  const year=String(d.year||years[0]||new Date().getFullYear());
  assert_(years.includes(year),'Ano letivo inválido.');
  const sc=scope_(u,year);
  const permittedSchool=s=>u.perfil==='secretaria'||(u.perfil==='escola'?s===u.escolaId:sc.monitorSchoolIds.includes(s));
  const canRoute=r=>u.perfil==='secretaria'||(u.perfil==='escola'?r.escolaId===u.escolaId:sc.monitorRouteIds.includes(r.id));
  const schools=sc.schools.filter(s=>permittedSchool(s.id));
  const routes=sc.routes.filter(canRoute);
  const routeIds=routes.map(r=>r.id);
  const classes=rows_('TURMAS').filter(r=>active_(r)&&r.ano===year&&permittedSchool(r.escolaId));
  const stops=rows_('PONTOS').filter(r=>active_(r)&&routeIds.includes(r.rotaId));
  const students=rows_('ESTUDANTES').filter(r=>active_(r)&&r.ano===year).filter(r=>{
    if(u.perfil==='secretaria')return true;
    if(u.perfil==='escola')return r.escolaId===u.escolaId;
    return routeIds.includes(r.rotaId)||(!r.rotaId&&sc.monitorSchoolIds.includes(r.escolaId));
  }).map(r=>{
    const result={...r};
    if(u.perfil==='monitor'){
      delete result.qrToken;
      if(!r.rotaId){result.responsavel='';result.celular='';}
    }
    return result;
  });
  const studentIds=students.map(s=>s.id);
  const day=String(d.day||Utilities.formatDate(new Date(),'America/Sao_Paulo','yyyy-MM-dd'));
  assert_(/^\d{4}-\d{2}-\d{2}$/.test(day),'Data inválida.');
  const calls=rows_('CHAMADAS').filter(r=>r.dia===day&&studentIds.includes(r.estudanteId));
  const result={version:PropertiesService.getScriptProperties().getProperty('VERSION')||'0',user:publicUser_(u),year,years,day,
    schools,routes,classes,stops,students,calls};
  if(u.perfil==='secretaria'){
    result.users=rows_('USUARIOS').map(publicUser_);
    result.assignments=rows_('ATRIBUICOES').filter(active_);
    result.audit=rows_('AUDITORIA').slice(-80).reverse();
  }
  return result;
}
function save_(u,d){
  const type=String(d.type||''),name=LABELS[type];
  assert_(!!name,'Cadastro inválido.');assert_(u.perfil!=='monitor'||type==='student','Monitor não pode criar cadastros.');
  const data=d.item||{};
  return locked_(function(){
    const old=data.id?get_(name,data.id):null;
    assert_(!data.id||!!old,'Registro para edição não encontrado.');
    const ts=now_(),year=String(data.ano||d.year||new Date().getFullYear());
    let obj=old?{...old}:{id:uuid_(),ativo:ACTIVE,criadoEm:ts};
    if(type==='school'){
      onlySecret_(u);obj.nome=required_(data.nome,'escola');
      assert_(!rows_(name).some(x=>x.id!==obj.id&&active_(x)&&x.nome.toLowerCase()===obj.nome.toLowerCase()),'Escola já cadastrada.');
    }
    if(type==='class'||type==='route'){
      assert_(u.perfil!=='monitor','Ação não permitida.');
      const schoolId=u.perfil==='escola'?u.escolaId:String(data.escolaId||'');
      assert_(!!get_('ESCOLAS',schoolId)&&active_(get_('ESCOLAS',schoolId)),'Escola inválida.');
      assert_(rows_('ANOS').some(a=>a.ano===year&&active_(a)),'Ano inválido.');
      if(old){assert_(old.ano===year&&old.escolaId===schoolId,'Não é possível transferir turma ou rota entre escolas/anos.');}
      obj.ano=year;obj.escolaId=schoolId;obj.nome=required_(data.nome,type==='class'?'turma':'rota');
      if(type==='route')obj.descricao=optional_(data.descricao,250);
    }
    if(type==='stop'){
      assert_(u.perfil!=='monitor','Ação não permitida.');
      const route=get_('ROTAS',String(data.rotaId||''));
      assert_(route&&active_(route),'Rota inválida.');
      assert_(u.perfil==='secretaria'||route.escolaId===u.escolaId,'Rota de outra escola.');
      if(old)assert_(old.rotaId===route.id,'Não é possível transferir ponto de rota.');
      obj.rotaId=route.id;obj.nome=required_(data.nome,'ponto');obj.ordem=String(Math.max(1,Math.min(999,Number(data.ordem)||1)));
    }
    if(type==='student'){
      if(u.perfil==='monitor'){
        assert_(!!old && active_(old),'Monitor só pode classificar estudantes já cadastrados.');
        const sc=scope_(u,old.ano);
        const destRoute=get_('ROTAS',String(data.rotaId||old.rotaId||''));
        assert_(destRoute && sc.monitorRouteIds.includes(destRoute.id) && destRoute.escolaId===old.escolaId,'A rota deve estar atribuída a você e atender à escola do estudante.');
        assert_(!old.rotaId||old.rotaId===destRoute.id,'Somente a Secretaria ou a escola pode alterar a rota de um estudante já vinculado a outra rota.');
        const point=get_('PONTOS',String(data.pontoId||''));
        assert_(point&&active_(point)&&point.rotaId===destRoute.id,'Ponto inválido para a rota.');
        obj.rotaId=destRoute.id;obj.pontoId=point.id;obj.atualizadoEm=ts;
      }else{
        const schoolId=u.perfil==='escola'?u.escolaId:String(data.escolaId||'');
        assert_(!!get_('ESCOLAS',schoolId),'Escola inválida.');
        if(old)assert_(u.perfil==='secretaria'||old.escolaId===u.escolaId,'Estudante de outra escola.');
        assert_(rows_('ANOS').some(a=>a.ano===year&&active_(a)),'Ano inválido.');
        const cls=get_('TURMAS',String(data.turmaId||''));
        assert_(cls&&active_(cls)&&cls.escolaId===schoolId&&cls.ano===year,'Turma inválida para a escola e o ano.');
        const routeId=String(data.rotaId||''),pointId=String(data.pontoId||'');
        if(routeId){const rt=get_('ROTAS',routeId);assert_(rt&&active_(rt)&&rt.escolaId===schoolId&&rt.ano===year,'Rota inválida.');}
        if(pointId){const pt=get_('PONTOS',pointId);assert_(routeId&&pt&&active_(pt)&&pt.rotaId===routeId,'Ponto não pertence à rota.');}
        else assert_(!pointId,'Ponto inválido.');
        if(old)assert_(old.ano===year,'Não é possível mudar o ano de um estudante. Cadastre uma matrícula no novo ano.');
        obj.ano=year;obj.escolaId=schoolId;obj.turmaId=cls.id;obj.nome=required_(data.nome,'nome completo do estudante');
        obj.rotaId=routeId;obj.pontoId=pointId;
        obj.responsavel=required_(data.responsavel,'nome do responsável');
        obj.celular=optional_(data.celular,24);
        if(obj.celular)assert_(/^[+()\d\s-]{8,24}$/.test(obj.celular),'Celular inválido.');
        if(!old)obj.qrToken=uuid_().replace(/-/g,'')+uuid_().replace(/-/g,'');
        obj.atualizadoEm=ts;
      }
    }
    if(old)replace_(name,obj);else append_(name,obj);
    audit_(u.id,old?'EDITAR':'CRIAR',name,obj.id);touch_();
    return {ok:true,id:obj.id};
  });
}
function disable_(u,d){
  const type=String(d.type||''),name=LABELS[type];assert_(!!name,'Cadastro inválido.');
  assert_(u.perfil!=='monitor','Ação não permitida.');
  if(type==='school')onlySecret_(u);
  return locked_(function(){
    const obj=get_(name,d.id);assert_(obj&&active_(obj),'Registro inexistente ou já desativado.');
    let schoolId=obj.escolaId;
    if(type==='stop'){const rt=get_('ROTAS',obj.rotaId);schoolId=rt&&rt.escolaId;}
    if(type==='school')schoolId=obj.id;
    assert_(u.perfil==='secretaria'||schoolId===u.escolaId,'Registro de outra escola.');
    if(type==='school')assert_(!rows_('ESTUDANTES').some(s=>active_(s)&&s.escolaId===obj.id),'Escola possui estudantes ativos.');
    if(type==='class')assert_(!rows_('ESTUDANTES').some(s=>active_(s)&&s.turmaId===obj.id),'Turma possui estudantes ativos.');
    if(type==='route')assert_(!rows_('ESTUDANTES').some(s=>active_(s)&&s.rotaId===obj.id),'Rota possui estudantes ativos.');
    if(type==='stop')assert_(!rows_('ESTUDANTES').some(s=>active_(s)&&s.pontoId===obj.id),'Ponto possui estudantes ativos.');
    obj.ativo='NAO';replace_(name,obj);audit_(u.id,'DESATIVAR',name,obj.id);touch_();return {ok:true};
  });
}
function createUser_(u,d){onlySecret_(u);
  const x=d.item||{},name=required_(x.nome,'nome'),login=required_(x.login,'login',90).toLowerCase();
  assert_(/^[a-z0-9._@-]{3,90}$/.test(login),'Login pode conter letras, números, ponto, hífen e @.');
  assert_(ROLES.includes(x.perfil),'Perfil inválido.');
  if(x.perfil==='escola')assert_(!!get_('ESCOLAS',x.escolaId),'Escola obrigatória para usuário de escola.');
  if(x.perfil==='monitor')assert_(!x.escolaId,'Monitor recebe acesso pelas rotas atribuídas, não pela escola.');
  return locked_(function(){
    const current=x.id?get_('USUARIOS',x.id):null;
    assert_(!x.id||!!current,'Usuário não encontrado.');
    assert_(!rows_('USUARIOS').some(v=>v.id!==x.id&&v.login===login),'Login já utilizado.');
    let obj;
    if(current){
      obj={...current,nome:name,login,perfil:x.perfil,escolaId:x.perfil==='escola'?x.escolaId:'',ativo:x.ativo==='NAO'?'NAO':'SIM'};
      assert_(!(current.id===u.id&&obj.ativo==='NAO'),'Não é possível desativar seu próprio acesso.');
      if(x.password){assert_(isStrongPassword_(x.password),'Senha inicial precisa de 12 caracteres.');obj.salt=uuid_()+uuid_();obj.hash=pwdHash_(x.password,obj.salt);obj.trocarSenha=ACTIVE;}
      replace_('USUARIOS',obj);
    }else{
      assert_(isStrongPassword_(x.password),'Informe uma senha temporária de ao menos 12 caracteres.');
      obj=newUser_({nome:name,login,perfil:x.perfil,escolaId:x.perfil==='escola'?x.escolaId:''},x.password,true);
      append_('USUARIOS',obj);
    }
    audit_(u.id,current?'EDITAR':'CRIAR','USUARIOS',obj.id);touch_();return {ok:true,id:obj.id};
  });
}
function setAssignments_(u,d){onlySecret_(u);
  return locked_(function(){
    const usr=get_('USUARIOS',d.userId);assert_(usr&&active_(usr)&&usr.perfil==='monitor','Escolha um monitor ativo.');
    const year=String(d.year||'');
    assert_(rows_('ANOS').some(a=>a.ano===year&&active_(a)),'Ano letivo inválido.');
    const ids=Array.isArray(d.routeIds)?Array.from(new Set(d.routeIds.map(String))):[];
    ids.forEach(id=>assert_(get_('ROTAS',id)&&active_(get_('ROTAS',id))&&get_('ROTAS',id).ano===year,'Rota inválida para o ano.'));
    const yearRoutes=rows_('ROTAS').filter(r=>r.ano===year).map(r=>r.id);
    rows_('ATRIBUICOES').filter(a=>a.usuarioId===usr.id&&active_(a)&&yearRoutes.includes(a.rotaId)).forEach(a=>{a.ativo='NAO';replace_('ATRIBUICOES',a);});
    ids.forEach(id=>append_('ATRIBUICOES',{id:uuid_(),usuarioId:usr.id,rotaId:id,ativo:ACTIVE}));
    audit_(u.id,'ATRIBUIR','ATRIBUICOES',usr.id);touch_();return {ok:true};
  });
}
function createYear_(u,d){onlySecret_(u);
  const year=String(d.year||'');assert_(/^20\d{2}$/.test(year),'Ano letivo inválido.');
  return locked_(function(){
    assert_(!rows_('ANOS').some(x=>x.ano===year),'Ano letivo já existe.');
    append_('ANOS',{id:uuid_(),ano:year,ativo:ACTIVE,criadoEm:now_()});
    audit_(u.id,'CRIAR','ANOS',year);touch_();return {ok:true};
  });
}
function attendance_(u,d){
  assert_(u.perfil==='monitor'||u.perfil==='secretaria','A chamada é exclusiva de monitores e Secretaria.');
  const day=String(d.day||''),direction=String(d.sentido||''),status=String(d.status||'');
  assert_(/^\d{4}-\d{2}-\d{2}$/.test(day),'Data inválida.');
  assert_(['IDA','VOLTA'].includes(direction),'Selecione ida ou volta.');
  assert_(['PRESENTE','AUSENTE'].includes(status),'Status inválido.');
  return locked_(function(){
    const key=String(d.qr||'').replace(/^TC:/,'').trim();
    const student=key?rows_('ESTUDANTES').find(x=>x.qrToken===key):get_('ESTUDANTES',d.studentId);
    assert_(student&&active_(student),'Estudante não encontrado ou crachá inválido.');
    const route=get_('ROTAS',student.rotaId);
    assert_(route&&active_(route)&&route.ano===student.ano,'Estudante sem rota válida.');
    if(u.perfil==='monitor')assert_(scope_(u,student.ano).monitorRouteIds.includes(route.id),'O estudante não pertence a uma rota atribuída a você.');
    if(d.routeId)assert_(String(d.routeId)===route.id,'O crachá pertence a outra rota. Selecione a rota correta.');
    const existing=rows_('CHAMADAS').find(x=>x.estudanteId===student.id&&x.dia===day&&x.sentido===direction);
    assert_(!existing||existing.status!==status,'Chamada já registrada com esse status.');
    const obj=existing?{...existing}:{id:uuid_()};
    Object.assign(obj,{dia:day,sentido:direction,estudanteId:student.id,rotaId:student.rotaId,pontoId:student.pontoId,
      status,usuarioId:u.id,registradoEm:now_()});
    if(existing)replace_('CHAMADAS',obj);else append_('CHAMADAS',obj);
    audit_(u.id,existing?'CORRIGIR_CHAMADA':'CHAMADA','CHAMADAS',obj.id);touch_();
    return {ok:true,studentName:student.nome,status:status,sentido:direction,registradoEm:obj.registradoEm};
  });
}

/** Detecta edições MANUAIS na planilha e avisa os navegadores no próximo polling.
 * Não valida edições diretas: dê permissão de edição na planilha apenas ao administrador. */
function onEdit(e) {
  try {
    if (e && e.range && DB[e.range.getSheet().getName()]) touch_();
  } catch (err) { console.error(err); }
}
