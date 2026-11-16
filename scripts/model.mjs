export const ID='sangue-escuro-progresso';
export const TYPES={continuous:'Contínua',milestones:'Marcos',segments:'Segmentada',pips:'Ícones sequenciais',tug:'Cabo de guerra',radial:'Relógio radial'};
export const SOURCES={manual:'Manual',actor:'Recurso da ficha · leitura',item:'Arma: PD ou munição · leitura',world:'Relógio do mundo',threat:'Relógio de ameaça da Logística · leitura'};
export const RESOURCES={pv:'Pontos de Vida',ps:'Sanidade',estresse:'Estresse',fome:'Fome',exposicao:'Exposição',exaustao:'Exaustão',sorte:'Sorte','turno.acoes':'Ações','turno.reacao':'Reação','pe.disponivel':'PE disponíveis'};
export const ICONS={'fa-solid fa-skull':'Caveira','fa-solid fa-hourglass-half':'Ampulheta','fa-solid fa-key':'Chave','fa-solid fa-shield-halved':'Escudo','fa-solid fa-person-running':'Perseguição','fa-solid fa-heart':'Vida','fa-solid fa-brain':'Sanidade','fa-solid fa-bolt':'Energia','fa-solid fa-droplet':'Gota','fa-solid fa-coins':'Fichas','fa-solid fa-flag':'Objetivo','fa-solid fa-gear':'Oficina'};
export const copy=x=>structuredClone(x);
export const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const text=(s,max=160)=>String(s??'').trim().slice(0,max);
export function number(v,min,max,integer=false){const n=Number(v);if(v===''||v==null||!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw Error('Valor numérico fora do intervalo.');return n;}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function asset(s){s=text(s,1800);if(!s)return '';if(/[\u0000-\u001f<>"'\\]/.test(s)||s.startsWith('//')||/^[a-z][a-z0-9+.-]*:/i.test(s)&&!/^https?:\/\//i.test(s))throw Error('Use uma imagem do Foundry ou URL HTTP/HTTPS.');return s;}
export const color=(s,def)=>/^#[\da-f]{6}$/i.test(s??'')?s:def;
export const icon=s=>Object.hasOwn(ICONS,s)?s:'fa-solid fa-skull';
export function normalise(d){
 if(!Object.hasOwn(TYPES,d.type))throw Error('Tipo de barra inválido.');
 const limit=d.type==='radial'?24:['segments','pips'].includes(d.type)?40:1000,max=number(d.max,1,limit,true);
 const title=text(d.title);if(!title)throw Error('Informe o título.');
 const source={kind:Object.hasOwn(SOURCES,d.source?.kind)?d.source.kind:'manual'};
 if(['actor','item'].includes(source.kind)){source.actorId=text(d.source.actorId,100);if(!source.actorId)throw Error('Escolha o personagem.');source.resource=source.kind==='actor'&&Object.hasOwn(RESOURCES,d.source.resource)?d.source.resource:source.kind==='item'&&['pd','ammo'].includes(d.source.resource)?d.source.resource:'pv';if(source.kind==='item'&&!['pd','ammo'].includes(source.resource))throw Error('Escolha PD ou munição.');source.itemId=text(d.source.itemId,100);}
 if(source.kind==='world'){source.baseTime=number(d.source.baseTime,-1e12,1e12);source.duration=number(d.source.duration,1,31536000,true);source.step=number(d.source.step,1,86400,true);}
 if(source.kind==='threat'){source.threatId=text(d.source.threatId,100);if(!source.threatId)throw Error('Escolha o relógio de ameaça.');}
 const entry=x=>({label:text(x.label,100),icon:icon(x.icon),image:asset(x.image)});
 if(!Array.isArray(d.milestones??[])||d.milestones?.length>10)throw Error('Use no máximo dez marcos.');
 if(!Array.isArray(d.pips??[])||d.pips?.length>40)throw Error('Use no máximo quarenta ícones.');
 return {id:text(d.id,80),title,type:d.type,max,value:source.kind==='manual'?clamp(number(d.value,0,100000,true),0,max):0,visible:d.visible===true,hideTitle:d.hideTitle===true,interactive:source.kind==='manual'&&d.interactive===true,color:color(d.color,'#934454'),secondary:color(d.secondary,'#65778d'),track:color(d.track,'#242a31'),icon:icon(d.icon),image:asset(d.image),texture:asset(d.texture),left:text(d.left,50),right:text(d.right,50),milestones:(d.milestones??[]).map(m=>({...entry(m),at:number(m.at,0,100)})).sort((a,b)=>a.at-b.at),pips:(d.pips??[]).map(entry),source};
}
export const initial=()=>({id:'',title:'Novo progresso',type:'continuous',max:10,value:0,visible:false,hideTitle:false,interactive:false,color:'#934454',secondary:'#65778d',track:'#242a31',icon:'fa-solid fa-skull',image:'',texture:'',left:'',right:'',milestones:[],pips:[],source:{kind:'manual',actorId:'',resource:'pv',itemId:'',threatId:'',baseTime:0,duration:1800,step:60}});
export function project(view){if(!view.visible||view.invalid)return null;const {id,type,max,value,color,secondary,track,icon,image,texture,left,right,milestones,pips,interactive,hideTitle}=view;return {id,type,max,value,color,secondary,track,icon,image,texture,left,right,milestones,pips,interactive,hideTitle,title:hideTitle?'':view.title};}
export function changeValue(bar,op,value){if(bar.source.kind!=='manual')throw Error('A origem desta barra é controlada fora do progresso manual.');if(op==='delta')return clamp(bar.value+number(value,-1,1,true),0,bar.max);if(op==='segment'){const n=number(value,1,bar.max,true);if(!['segments','pips','radial'].includes(bar.type))throw Error('Este tipo não possui segmentos clicáveis.');return bar.value>=n?n-1:n;}if(op==='set')return number(value,0,bar.max,true);throw Error('Operação inválida.');}
export function sector(i,n){if(n===1)return 'M50 50 m0 -46 a46 46 0 1 1 0 92 a46 46 0 1 1 0 -92';const a=-Math.PI/2+2*Math.PI*i/n,b=-Math.PI/2+2*Math.PI*(i+1)/n;return `M50 50 L${50+46*Math.cos(a)} ${50+46*Math.sin(a)} A46 46 0 ${b-a>Math.PI?1:0} 1 ${50+46*Math.cos(b)} ${50+46*Math.sin(b)} Z`;}
