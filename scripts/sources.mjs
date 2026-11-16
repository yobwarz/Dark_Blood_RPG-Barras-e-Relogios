import {ID,RESOURCES,clamp,copy} from './model.mjs';
const get=(o,k)=>k.split('.').reduce((a,k)=>a?.[k],o);
export const all=c=>c?.contents??Array.from(c?.values?.()??c??[]);
export function threats(){if(!game.user.isGM||!game.modules.get('sangue-escuro-logistica')?.active)return [];return game.settings.get('sangue-escuro-logistica','dados')?.campanhaDRS?.relogios??[];}
export function resolve(b){const v=copy(b),s=b.source;let value=b.value,max=b.max;v.sourceLabel='Manual';
 if(s.kind==='actor'){
  const a=game.actors.get(s.actorId);if(!a||!Object.hasOwn(RESOURCES,s.resource))return {...v,invalid:'Personagem ou recurso indisponível'};
  const r=get(a.system,s.resource);value=typeof r==='object'?r.value:r;max=typeof r==='object'?r.max:s.resource==='turno.acoes'?(game.sangueEscuro?.api?.regra('acoesPorTurno')??3):s.resource==='turno.reacao'?1:b.max;v.sourceLabel=a.name+' · '+RESOURCES[s.resource];v.actorId=a.id;
 }else if(s.kind==='item'){
  const a=game.actors.get(s.actorId),i=a?.items.get(s.itemId);if(!i||i.type!=='arma')return {...v,invalid:'Arma ou personagem indisponível'};
  value=s.resource==='pd'?i.system.durabilidade?.value:i.carregador??i.system.municaoAtual;max=s.resource==='pd'?i.system.durabilidade?.max:i.system.capacidade;v.sourceLabel=a.name+' · '+i.name+' · '+(s.resource==='pd'?'PD':'Munição');v.actorId=a.id;
 }else if(s.kind==='world'){
  value=clamp(Number(game.time.worldTime)-s.baseTime,0,s.duration);max=s.duration;v.sourceLabel='Relógio do mundo · +' + s.step+' s';
 }else if(s.kind==='threat'){
  const r=threats().find(r=>r.id===s.threatId);if(!r)return {...v,invalid:'Relógio de ameaça indisponível'};value=r.progresso;max=r.max;v.sourceLabel='Ameaça · '+r.nome+(r.encerrado?' · encerrada':'');
 }
 if(!Number.isFinite(value)||!Number.isFinite(max)||max<=0)return {...v,invalid:'A origem não possui valor ou limite válido'};
 v.rawValue=value;v.rawMax=max;v.value=clamp(value/max,0,1)*b.max;v.counter=s.kind==='world'?`${formatTime(value)} / ${formatTime(max)}`:`${value} / ${max}`;return v;
}
export const formatTime=n=>{n=Math.max(0,Math.floor(n));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':');};
export function sourceChoices(){if(!game.user.isGM)return {actors:[],weapons:[],threats:[]};return {actors:all(game.actors).filter(a=>a.type==='character').map(a=>({id:a.id,name:a.name})),weapons:all(game.actors).flatMap(a=>all(a.items).filter(i=>i.type==='arma').map(i=>({actorId:a.id,id:i.id,name:a.name+' · '+i.name}))),threats:threats().map(t=>({id:t.id,name:t.nome}))};}
