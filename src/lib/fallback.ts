import type { GradioEndpoint, InputSchema, Json, RemoteExecutionOption, SpaceExecutionOption } from './types';
import {rankOptions} from './ranking';
export type PromptDraft = Partial<Record<'prompt'|'negative',string>>;
function promptRole(input:InputSchema):keyof PromptDraft|undefined {
 if(input.component!=='textbox')return;
 const label=input.label.trim().toLowerCase().replace(/[_-]/g,' ');
 if(['prompt','positive prompt','text prompt','prompt positivo'].includes(label))return 'prompt';
 if(['negative prompt','prompt negativo'].includes(label))return 'negative';
}
export function capturePrompts(endpoint:GradioEndpoint,values:Json[]):PromptDraft {
 const draft:PromptDraft={};endpoint.inputs.forEach((input,i)=>{const role=promptRole(input);if(role&&typeof values[i]==='string')draft[role]=values[i];});return draft;
}
export function formDefaults(endpoint:GradioEndpoint,draft:PromptDraft={}):Json[]{return endpoint.inputs.map(p=>{
 if(['image','audio','video','file'].includes(p.component))return null;
 const role=promptRole(p);if(role&&draft[role]!==undefined)return draft[role]!;
 return p.defaultValue??(p.component==='checkbox'?false:['number','slider'].includes(p.component)?p.minimum??0:p.choices[0]??'');
});}
export function quotaAlternatives(current:SpaceExecutionOption,options:RemoteExecutionOption[]):RemoteExecutionOption[]{
 const candidates=rankOptions(options.filter(o=>o.status==='RUNNING'&&o.mode!=='UNAVAILABLE'&&(o.kind==='provider'||o.id!==current.id&&o.zeroGpu!==true&&['EXACT','HIGH'].includes(o.confidence))));
 // Known non-ZeroGPU infrastructure first. Unknown hardware is never presented as quota-independent.
 return candidates.sort((a,b)=>Number(b.kind==='provider'||b.zeroGpu===false)-Number(a.kind==='provider'||a.zeroGpu===false)).slice(0,5);
}
