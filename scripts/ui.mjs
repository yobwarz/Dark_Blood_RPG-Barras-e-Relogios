import {ID,initial,copy,normalise,esc} from './model.mjs';
import {read,views,command,publish} from './store.mjs';
import {resolve} from './sources.mjs';
import {visual,hud} from './visual.mjs';
import {editorForm,readForm} from './editor-html.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
const gm=()=>{if(!game.user.isGM)throw Error('Apenas o Mestre pode configurar indicadores.');};
export const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(e){console.error(ID,e);ui.notifications.warn(e.message);}};
const find=id=>{const b=read().bars.find(b=>b.id===id);if(!b)throw Error('Barra indisponível.');return b;};
const confirm=(title,content)=>foundry.applications.api.DialogV2.confirm({window:{title},content});
export function bindProgress(root){root.addEventListener('click',safe(async e=>{const b=e.target.closest('[data-progress-action]');if(!b||b.disabled)return;e.preventDefault();b.disabled=true;try{await command(b.dataset.progressAction,{id:b.dataset.id,value:Number(b.dataset.value)});}finally{if(b.isConnected)b.disabled=false;}}));root.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('path[data-progress-action]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});}
export class ProgressHUD extends HandlebarsApplicationMixin(ApplicationV2){
 static DEFAULT_OPTIONS={id:'sangue-escuro-progresso-hud',classes:['sepro-window'],window:{title:'Barras e Relógios',resizable:true},position:{width:470,height:700},actions:{create:ProgressHUD.create,edit:ProgressHUD.edit,delete:ProgressHUD.delete,duplicate:ProgressHUD.duplicate,visibility:ProgressHUD.visibility,move:ProgressHUD.move,set:ProgressHUD.set,pin:ProgressHUD.pin,sync:ProgressHUD.sync,advance:ProgressHUD.advance,source:ProgressHUD.source,reconcile:ProgressHUD.reconcile}};
 static PARTS={body:{template:`modules/${ID}/templates/hud.hbs`,scrollable:['.sepro-hud-scroll']}};
 async _prepareContext(){gm();return {body:hud(views(),{pinned:game.settings.get(ID,'pinned'),pending:read().clockPending})};}
 _onRender(c,o){super._onRender?.(c,o);this.element.classList.toggle('sepro-pinned',game.settings.get(ID,'pinned'));bindProgress(this.element.querySelector('.sepro-dashboard'));}
 static create(){gm();return new ProgressEditor().render(true);}
 static edit(e,b){gm();return new ProgressEditor(find(b.dataset.id)).render(true);}
 static async delete(e,b){gm();const v=find(b.dataset.id);if(await confirm('Excluir indicador',`<p>Excluir ${esc(v.title)}? A origem vinculada, se existir, não será alterada.</p>`))await safe(()=>command('delete',{id:v.id}))();}
 static duplicate(e,b){gm();return safe(()=>command('duplicate',{id:b.dataset.id}))();}
 static visibility(e,b){gm();return safe(()=>command('visibility',{id:b.dataset.id}))();}
 static move(e,b){gm();return safe(()=>command('move',{id:b.dataset.id,direction:Number(b.dataset.direction)}))();}
 static async set(e,b){gm();const v=find(b.dataset.id);const n=await foundry.applications.api.DialogV2.prompt({window:{title:'Definir progresso'},content:`<label>Valor (0–${v.max})<input type="number" name="value" min="0" max="${v.max}" step="1" value="${v.value}"></label>`,rejectClose:false,ok:{label:'Definir',callback:(e,b)=>Number(b.form.elements.value.value)}});if(n!==null&&n!==undefined)await safe(()=>command('set',{id:v.id,value:n}))();}
 static async pin(){gm();await game.settings.set(ID,'pinned',!game.settings.get(ID,'pinned'));this.render(false);}
 static sync(){gm();return safe(async()=>{if(game.users.activeGM?.id!==game.user.id)throw Error('Use o Mestre ativo para sincronizar.');await publish();}) ();}
 static async advance(e,b){gm();const v=find(b.dataset.id);if(await confirm('Avançar relógio do mundo',`<p>Avançar ${v.source.step} segundos no relógio do mundo? Esse tempo também é contado por filtros, procedimentos, viagens e outros módulos ativos. Não há recuo automático dos efeitos.</p>`))await safe(()=>command('advance',{id:v.id}))();}
 static source(e,b){gm();const v=find(b.dataset.id);if(v.source.kind==='threat')return game.sangueEscuro?.logistica?.abrir();return game.actors.get(v.source.actorId)?.sheet?.render(true);}
 static async reconcile(){gm();const p=read().clockPending;if(!p)return;if(await confirm('Conferir avanço interrompido',`<p>O tempo deveria passar de ${p.before} para ${p.target} s. Agora está em ${Number(game.time.worldTime)} s.</p><p>Confira no relógio e nos módulos afetados se o avanço ocorreu. Confirmar encerra a pendência sem avançar novamente. Se faltar tempo, conte-o manualmente antes de iniciar outro avanço. Nunca há repetição automática de resultado incerto.</p>`))await safe(()=>command('reconcile',{confirmed:true}))();}
}
let panel;
export function openHUD(){gm();if(!panel||!panel.rendered)panel=new ProgressHUD();return panel.render(true);}
export function refreshHUD(){if(panel?.rendered)panel.render(false);}
export class OpenMenu extends ApplicationV2{async render(){openHUD();return this;}}
export class ProgressEditor extends HandlebarsApplicationMixin(ApplicationV2){
 constructor(bar=null,options={}){super(options);gm();this.draft=bar?copy(bar):initial();if(!bar)this.draft.source.baseTime=Number(game.time.worldTime);this.revision=bar?.revision;}
 static DEFAULT_OPTIONS={classes:['sepro-window','sepro-editor-window'],tag:'form',window:{title:'Configurar indicador',resizable:true},position:{width:730,height:790},form:{handler:ProgressEditor.save,closeOnSubmit:false},actions:{cancel:ProgressEditor.cancel,image:ProgressEditor.image,addMilestone:ProgressEditor.addMilestone,removeEntry:ProgressEditor.removeEntry,fillPips:ProgressEditor.fillPips}};
 static PARTS={body:{template:`modules/${ID}/templates/editor.hbs`,scrollable:['.sepro-editor-scroll']}};
 async _prepareContext(){gm();return {body:editorForm(this.draft)};}
 sync(){this.draft=readForm(this.element,this.draft);}
 preview(){const root=this.element;const type=root.querySelector('[name=type]').value,source=root.querySelector('[name=sourceKind]').value;
  for(const g of root.querySelectorAll('[data-type]'))g.hidden=!g.dataset.type.split(' ').includes(type);
  for(const g of root.querySelectorAll('[data-source]'))g.hidden=!g.dataset.source.split(' ').includes(source);
  const interactive=root.querySelector('[name=interactive]');interactive.disabled=source!=='manual';if(source!=='manual')interactive.checked=false;
  const progress=root.querySelector('[name=value]');progress.disabled=source!=='manual';
  try{const b=normalise(readForm(root,this.draft));root.querySelector('[data-preview]').innerHTML=visual({...resolve(b),title:b.title},{gm:true,preview:true});root.querySelector('[data-error]').textContent='';}catch(e){root.querySelector('[data-error]').textContent=e.message;root.querySelector('[data-preview]').innerHTML='';}
 }
 _onRender(c,o){super._onRender?.(c,o);const content=this.element.querySelector('.sepro-editor');content.addEventListener('input',()=>this.preview());content.addEventListener('change',e=>{
  if(e.target.name==='type'){const max=this.element.querySelector('[name=max]');const limit=e.target.value==='radial'?24:['segments','pips'].includes(e.target.value)?40:1000;max.max=limit;max.value=Math.min(limit,Math.max(1,Number(max.value)||10));}
  if(e.target.name==='actorId'){this.sync();this.draft.source.itemId='';this.render(false);return;}this.preview();
 });this.preview();}
 static async save(){gm();try{this.sync();const b=normalise(this.draft);await command(b.id?'update':'create',{bar:b,revision:this.revision});await this.close();}catch(e){ui.notifications.warn(e.message);}}
 static cancel(){return this.close();}
 static image(e,b){gm();const input=[...this.element.querySelectorAll('input[data-path]')].find(x=>x.dataset.path===b.dataset.path);if(!input)return;const FP=foundry.applications.apps.FilePicker.implementation;new FP({type:'image',current:input.value,callback:v=>{input.value=v;input.dispatchEvent(new Event('input',{bubbles:true}));}}).render(true);}
 static addMilestone(){gm();this.sync();if(this.draft.milestones.length>=10)return ui.notifications.warn('Limite de dez marcos.');this.draft.milestones.push({at:50,label:'Novo marco',icon:'fa-solid fa-flag',image:''});return this.render(false);}
 static removeEntry(e,b){gm();this.sync();const k=b.dataset.kind==='milestone'?'milestones':'pips';this.draft[k].splice(Number(b.dataset.index),1);return this.render(false);}
 static fillPips(){gm();this.sync();const n=Math.max(1,Math.min(40,Number(this.draft.max)||1));this.draft.pips=Array.from({length:n},(_,i)=>this.draft.pips[i]??{label:'Etapa '+(i+1),icon:this.draft.icon,image:''});return this.render(false);}
}
let overlay,resize,observer;
export function positionOverlay(){if(!overlay)return;const candidates=['sidebar','sidebar-content','ui-right'].map(id=>document.getElementById(id)).filter(Boolean).map(x=>x.getBoundingClientRect()).filter(r=>r.width>30&&r.width<=600&&r.left>window.innerWidth*.25&&r.height>50&&r.right>=window.innerWidth-450);const left=candidates.length?Math.min(...candidates.map(r=>r.left)):window.innerWidth;overlay.style.right=Math.max(12,window.innerWidth-left+14)+'px';overlay.style.width=Math.min(game.settings.get(ID,'overlayWidth'),Math.max(160,left-24))+'px';}
export function renderOverlay(){if(game.user.isGM)return;const bars=views();if(!bars.length){overlay?.remove();overlay=null;return;}if(!overlay){overlay=document.createElement('aside');overlay.id='sepro-player-overlay';overlay.className='sepro-overlay';overlay.setAttribute('aria-label','Indicadores compartilhados');document.body.append(overlay);bindProgress(overlay);}overlay.style.width=game.settings.get(ID,'overlayWidth')+'px';overlay.innerHTML=bars.map(b=>visual(b)).join('');positionOverlay();}
export function installOverlay(){if(game.user.isGM)return;window.addEventListener('resize',positionOverlay);const side=document.getElementById('sidebar')??document.getElementById('ui-right');if(side&&globalThis.ResizeObserver){resize=new ResizeObserver(positionOverlay);resize.observe(side);}if(side&&globalThis.MutationObserver){observer=new MutationObserver(positionOverlay);observer.observe(side,{attributes:true,attributeFilter:['class','style']});}renderOverlay();}
