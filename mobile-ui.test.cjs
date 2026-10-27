/* Verificação local da renderização mobile — dados fictícios, sem Google. */
const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');const path=require('node:path');
const root=path.resolve(__dirname,'..');const source=fs.readFileSync(path.join(root,'Client.html'),'utf8');
const exposed=source.replace('render();if(S.token)load();','window.__test={S,render,attendanceScreen,dashboard,handleClick};');
assert.notEqual(exposed,source,'ponto de instrumentação presente');
const nodes={app:{innerHTML:''},toast:{append(){}},scannerArea:{innerHTML:''}};
const storage={rc_session:'preview-token'};
const context={Date,Intl,console,sessionStorage:{getItem:k=>storage[k]||'',setItem:(k,v)=>storage[k]=v,removeItem:k=>delete storage[k]},window:{addEventListener(){},scrollTo(){}},document:{getElementById:id=>nodes[id]||null,addEventListener(){},hidden:false},setInterval(){},setTimeout(){},confirm(){return true;}};
vm.createContext(context);vm.runInContext(exposed,context);
const app=context.window.__test;assert.ok(app,'interface inicializada');
app.S.data={version:'1',year:'2026',years:['2026'],day:'2026-10-27',user:{id:'m1',nome:'Monitor Teste',perfil:'monitor'},schools:[{id:'s1',nome:'Escola municipal'}],routes:[{id:'r1',nome:'Rota 1',escolaId:'s1'}],stops:[{id:'p1',nome:'Ponto 1',rotaId:'r1'}],classes:[],students:[{id:'st1',nome:'Aluno Fictício',escolaId:'s1',rotaId:'r1',pontoId:'p1'}],calls:[{estudanteId:'st1',sentido:'IDA',status:'PRESENTE',registradoEm:'2026-10-27T10:11:00.000Z'}]};app.S.year='2026';app.S.view='attendance';app.S.day='2026-10-27';
app.render();let markup=nodes.app.innerHTML;
assert.match(markup,/data-direction="IDA"/);assert.match(markup,/data-direction="VOLTA"/);assert.match(markup,/Ida.*Para a escola/s);assert.match(markup,/Volta.*Para casa/s);assert.match(markup,/Embarque para a escola/);assert.match(markup,/Registrado às 07:11/);assert.match(markup,/Embarcou/);
(async()=>{
await app.handleClick({target:{closest:()=>({dataset:{act:'chooseDirection',direction:'VOLTA',context:'call'}})}});
markup=nodes.app.innerHTML;
assert.equal(app.S.sentido,'VOLTA');assert.equal(storage.rc_sentido,'VOLTA');assert.match(markup,/Embarque de volta para casa/);assert.match(markup,/data-direction="VOLTA"[^>]*aria-label="Volta: Para casa" aria-pressed="true"/);assert.match(markup,/Aguardando/);assert.doesNotMatch(markup,/Registrado às 07:11/,'a chamada da ida não aparece na volta');
app.S.view='dashboard';app.render();assert.match(nodes.app.innerHTML,/quick-trip-panel/);
await app.handleClick({target:{closest:()=>({dataset:{act:'chooseDirection',direction:'IDA',context:'quick'}})}});
assert.equal(app.S.view,'attendance');assert.equal(app.S.sentido,'IDA');
// Gerar prévia estática montada pela interface real (sem senhas ou dados institucionais).
if(process.env.PREVIEW_OUT){const css=fs.readFileSync(path.join(root,'Styles.html'),'utf8');fs.writeFileSync(process.env.PREVIEW_OUT,`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="app">${nodes.app.innerHTML}</div></body></html>`);}
console.log('PASS: botões Ida/Volta, indicadores, horários, isolamento das chamadas e atalhos do monitor.');
})().catch(e=>{console.error(e);process.exitCode=1;});
