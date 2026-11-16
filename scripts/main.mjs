import {ID,copy} from './model.mjs';
import {all} from './sources.mjs';
import {ensure,publish,views,read,command,processMessage,activeGM,queue} from './store.mjs';
import {OpenMenu,openHUD,refreshHUD,renderOverlay,installOverlay,positionOverlay,safe} from './ui.mjs';
let scheduled=false;
export function schedulePublish(){if(!activeGM()||scheduled)return;scheduled=true;queue(async()=>{scheduled=false;await publish();}).catch(e=>{console.error(ID,e);ui.notifications.warn('Barras e Relógios: não foi possível sincronizar. Use Sincronizar no painel do Mestre.');});}
const gmOnly=fn=>(...a)=>{if(!game.user.isGM)throw Error('Ação reservada ao Mestre.');return fn(...a);};
Hooks.once('init',()=>{
 if(game.system.id!=='sangue-escuro')return;
 game.settings.register(ID,'database',{scope:'world',config:false,type:String,default:''});
 game.settings.register(ID,'public',{scope:'world',config:false,type:Object,default:{schema:1,bars:[]},onChange:()=>{renderOverlay();refreshHUD();}});
 game.settings.register(ID,'mostrarJogadores',{name:'Mostrar indicadores para jogadores',hint:'Cada barra ainda precisa estar marcada como visível. Desligar remove todas da sobreposição.',scope:'world',config:true,type:Boolean,default:true,onChange:schedulePublish});
 game.settings.register(ID,'autoOpen',{name:'Abrir painel do Mestre ao entrar',scope:'client',config:true,type:Boolean,default:true});
 game.settings.register(ID,'pinned',{name:'Mestre: fixar painel sem bordas',hint:'O botão Soltar continua disponível dentro do painel para recuperar a janela.',scope:'client',config:true,type:Boolean,default:false,onChange:refreshHUD});
 game.settings.register(ID,'overlayWidth',{name:'Largura da sobreposição de indicadores',hint:'Preferência deste navegador, em pixels.',scope:'client',config:true,type:Number,default:340,range:{min:220,max:520,step:10},onChange:renderOverlay});
 game.settings.registerMenu(ID,'panel',{name:'Barras e Relógios',label:'Abrir painel do Mestre',hint:'Criar, editar, excluir e compartilhar indicadores; ligações opcionais com recursos do Sangue Escuro.',icon:'fa-solid fa-bars-progress',type:OpenMenu,restricted:true});
 const api={open:gmOnly(openHUD),getAll:()=>copy(views()),create:gmOnly(bar=>command('create',{bar})),update:gmOnly((id,changes)=>{const b=read().bars.find(b=>b.id===id);if(!b)throw Error('Barra não encontrada.');return command('update',{bar:{...b,...copy(changes),id},revision:b.revision});}),delete:gmOnly(id=>command('delete',{id})),setVisible:gmOnly(async(id,visible)=>{const b=read().bars.find(b=>b.id===id);if(!b)throw Error('Barra não encontrada.');if(b.visible!==!!visible)return command('visibility',{id});}),modify:(id,delta=1)=>command('delta',{id,value:delta}),set:gmOnly((id,value)=>command('set',{id,value})),sync:gmOnly(schedulePublish)};
 game.modules.get(ID).api=api;if(game.sangueEscuro)game.sangueEscuro.progresso=api;
});
export function controls(config){if(game.system.id!=='sangue-escuro'||!game.user.isGM)return;const groups=Array.isArray(config)?config:Object.values(config??{}),g=groups.find(g=>g.name==='tokens'||g.name==='token')??groups[0];if(!g?.tools)return;const tool={name:'sangueEscuroProgresso',title:'Barras e Relógios',icon:'fa-solid fa-bars-progress',button:true,visible:true,onChange:()=>openHUD()};if(Array.isArray(g.tools)){if(!g.tools.some(t=>t.name===tool.name))g.tools.push(tool);}else g.tools[tool.name]={...tool,order:Object.keys(g.tools).length};}
Hooks.on('getSceneControlButtons',controls);
async function bootGM(){if(!activeGM())return;await queue(async()=>{await ensure();await publish();});for(const m of all(game.messages).filter(m=>m.getFlag(ID,'status')==='pending'))await processMessage(m);}
Hooks.once('ready',async()=>{
 if(game.system.id!=='sangue-escuro')return;
 Hooks.on('sangueEscuroProgresso.refresh',()=>{refreshHUD();renderOverlay();});
 for(const h of ['updateActor','createActor','deleteActor','updateItem','createItem','deleteItem','updateWorldTime'])Hooks.on(h,schedulePublish);
 Hooks.on('updateSetting',s=>{if(s.key==='sangue-escuro-logistica.dados')schedulePublish();});
 Hooks.on('updateJournalEntryPage',p=>{if(p.parent?.id===game.settings.get(ID,'database'))refreshHUD();});
 Hooks.on('createChatMessage',(message,options,userId)=>safe(()=>processMessage(message,userId))());
 for(const h of ['updateUser','createUser','deleteUser'])Hooks.on(h,()=>safe(bootGM)());
 for(const h of ['collapseSidebar','renderSidebar','renderSidebarTab'])Hooks.on(h,positionOverlay);
 await safe(bootGM)();if(game.user.isGM){if(game.settings.get(ID,'autoOpen'))openHUD();}else installOverlay();
});
