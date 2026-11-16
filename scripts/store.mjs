import {ID,copy,esc,normalise,project,changeValue,text,number} from './model.mjs';
import {resolve,all} from './sources.mjs';
export const activeGM=()=>game.user.isGM&&game.users.activeGM?.id===game.user.id;
const empty=()=>({schema:1,bars:[],receipts:[],clockPending:null});
let chain=Promise.resolve();
export function queue(fn){const p=chain.catch(()=>{}).then(fn);chain=p;return p;}
const uid=()=>foundry.utils.randomID();
function document(){return game.journal.get(game.settings.get(ID,'database'));}
function page(doc=document()){return doc?.pages?.find(p=>p.name==='Dados reservados');}
const decode=s=>s.replace(/^\s*<pre[^>]*>/,'').replace(/<\/pre>\s*$/,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
export function read(){if(!game.user.isGM)return empty();const p=page();if(!p)return empty();const s=JSON.parse(decode(p.text.content));if(s.schema!==1||!Array.isArray(s.bars))throw Error('Formato dos dados de progresso não reconhecido.');return s;}
export async function ensure(){if(!activeGM())throw Error('O Mestre ativo precisa estar conectado.');let doc=document();if(!doc){doc=all(game.journal).find(d=>d.getFlag(ID,'database'));if(!doc)doc=await JournalEntry.create({name:'Barras e Relógios — Dados do Mestre',ownership:{default:0},flags:{[ID]:{database:true}},pages:[{name:'Dados reservados',type:'text',ownership:{default:0},text:{format:1,content:'<pre>'+esc(JSON.stringify(empty()))+'</pre>'}}]});await game.settings.set(ID,'database',doc.id);}if(!page(doc))throw Error('A página de dados foi removida. Restaure-a pelo backup; nenhum dado será sobrescrito.');return doc;}
async function save(s){await ensure();await page().update({'text.content':'<pre>'+esc(JSON.stringify(s))+'</pre>'});await publish();}
export async function publish(){if(!activeGM())return;const bars=game.settings.get(ID,'mostrarJogadores')?read().bars.map(resolve).map(project).filter(Boolean):[];const data={schema:1,bars};if(JSON.stringify(game.settings.get(ID,'public'))!==JSON.stringify(data))await game.settings.set(ID,'public',data);Hooks.callAll('sangueEscuroProgresso.refresh');}
export function views(){return game.user.isGM?read().bars.map(resolve):copy(game.settings.get(ID,'public')?.bars??[]);}
function find(s,id){const b=s.bars.find(b=>b.id===id);if(!b)throw Error('Barra não encontrada.');return b;}
function receipt(s,key){s.receipts=[...(s.receipts??[]).filter(x=>x!==key),key].slice(-1000);}
export async function execute(op,data,user,key){return queue(async()=>{
 if(!activeGM())throw Error('Somente o Mestre ativo grava o progresso.');await ensure();let s=read();if(s.receipts?.includes(key)){await publish();return;}
 if(!user?.active)throw Error('Usuário indisponível.');const gm=user.isGM;
 if(!gm){if(!['delta','segment'].includes(op))throw Error('Operação reservada ao Mestre.');const b=find(s,data.id);if(!game.settings.get(ID,'mostrarJogadores')||!b.visible||!b.interactive||b.source.kind!=='manual')throw Error('Interação não permitida nesta barra.');}
 if(op==='create'||op==='update'){
  if(!gm)throw Error('Somente o Mestre cria ou edita.');const old=op==='update'?find(s,data.bar?.id):null;
  if(old&&data.revision!==old.revision)throw Error('A barra mudou enquanto o editor estava aberto. Reabra para preservar as alterações.');
  if(!old&&s.bars.length>=50)throw Error('Use no máximo cinquenta barras por mundo.');
  const b=normalise(data.bar);b.id=old?.id??uid();b.revision=(old?.revision??0)+1;if(old)s.bars[s.bars.indexOf(old)]=b;else s.bars.push(b);
 }else if(['delta','segment','set'].includes(op)){
  const b=find(s,data.id);b.value=changeValue(b,op,data.value);b.revision++;
 }else if(op==='visibility'){
  if(!gm)throw Error('Somente o Mestre altera visibilidade.');const b=find(s,data.id);b.visible=!b.visible;b.revision++;
 }else if(op==='delete'){
  if(!gm)throw Error('Somente o Mestre exclui.');find(s,data.id);s.bars=s.bars.filter(b=>b.id!==data.id);
 }else if(op==='duplicate'){
  if(!gm)throw Error('Somente o Mestre duplica.');if(s.bars.length>=50)throw Error('Limite de cinquenta barras.');const b=copy(find(s,data.id));b.id=uid();b.title=text(b.title+' · cópia');b.visible=false;b.revision=1;s.bars.push(b);
 }else if(op==='move'){
  if(!gm)throw Error('Somente o Mestre organiza.');const b=find(s,data.id),i=s.bars.indexOf(b),j=i+number(data.direction,-1,1,true);if(j>=0&&j<s.bars.length)[s.bars[i],s.bars[j]]=[s.bars[j],s.bars[i]];
 }else if(op==='advance'){
  if(!gm)throw Error('Somente o Mestre avança o tempo.');const b=find(s,data.id);if(b.source.kind!=='world')throw Error('A barra não acompanha o relógio.');if(resolve(b).value>=b.max)throw Error('Intervalo concluído. Edite o período antes de avançar.');if(s.clockPending)throw Error('Confira o avanço de relógio interrompido antes de continuar.');
  const before=Number(game.time.worldTime),delta=Math.min(b.source.step,b.source.baseTime+b.source.duration-before);s.clockPending={request:key,before,target:before+delta,bar:b.id};await save(s);
  // Resultado incerto nunca será repetido automaticamente. O painel oferece conferência.
  await game.time.advance(delta);s=read();receipt(s,key);s.clockPending=null;await save(s);return;
 }else if(op==='reconcile'){
  if(!gm||data.confirmed!==true)throw Error('Confirme a conferência manual do tempo.');if(s.clockPending)receipt(s,s.clockPending.request);s.clockPending=null;
 }else throw Error('Operação desconhecida.');
 receipt(s,key);await save(s);
});}
export async function command(op,data={}){
 if(activeGM())return execute(op,copy(data),game.user,'local.'+uid());
 if(!game.users.activeGM)throw Error('Nenhum Mestre ativo. O progresso não foi alterado.');
 return ChatMessage.create({speaker:{alias:'Barras e Relógios'},whisper:all(game.users).filter(u=>u.isGM).map(u=>u.id),content:'<p>Solicitação de progresso em processamento.</p>',flags:{[ID]:{request:{op,data:copy(data)},status:'pending'}}});
}
export async function processMessage(message,creatorId=null){if(!activeGM())return;return queue(async()=>{
 const current=game.messages.get(message.id);if(!current||current.getFlag(ID,'status')!=='pending')return;
 // userId do hook é informado pelo servidor; nenhum userId do payload é aceito.
 if(read().receipts?.includes(current.uuid))return {current,already:true};
 if(!creatorId||creatorId!==current.author?.id)return {current,unverified:true};
 const user=game.users.get(creatorId);if(!user)return;const req=current.getFlag(ID,'request');if(!req)return;
 return {current,user,req};
}).then(async check=>{
 if(!check)return;const {current,user,req}=check;
 if(check.unverified){await current.update({['flags.'+ID+'.status']:'rejected',content:'<p>Solicitação não autenticada nesta conexão. Confira o progresso antes de reenviar.</p>'});return;}
 if(check.already){await current.update({['flags.'+ID+'.status']:'done'});try{await current.delete();}catch{}return;}
 try{await execute(req.op,req.data??{},user,current.uuid);await current.update({['flags.'+ID+'.status']:'done'});}
 catch(e){await current.update({['flags.'+ID+'.status']:'rejected',content:'<p>Solicitação não aplicada: '+esc(e.message)+'</p>'});ui.notifications.warn(e.message);return;}
 try{await current.delete();}catch(e){console.warn(ID,'Solicitação concluída; mensagem mantida.',e);}
});}
