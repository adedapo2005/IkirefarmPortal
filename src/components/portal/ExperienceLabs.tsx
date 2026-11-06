'use client';
import React,{useState} from 'react';
import {metricWidgetCatalog,widgetLayout} from '@/lib/widget-layout';
import {weatherProfiles} from '@/lib/experience-model';
import Atmosphere from './Atmosphere';
import GlobalOperations from './GlobalOperations';
import {Btn,SelectField,Panel} from './Common';
import {Switch} from '@/components/ui/switch';
import {has,canPage} from '@/lib/portal-model';
import {WorkspaceProps} from './PortalExperience';
export function WeatherLab(){const [condition,setCondition]=useState('clear'),[phase,setPhase]=useState('day'),[wind,setWind]=useState('calm'),[status,setStatus]=useState('live'),[reduced,setReduced]=useState(false);return <section className={`weather-lab ${reduced?'reduce-motion':''}`}><header><span className="eyebrow">VISUAL TEST FIXTURE</span><h2>Weather Visual Lab</h2><p>23 atmospheric conditions. No live weather readings or provider connection.</p></header><div className="weather-lab-controls">{[['Condition',condition,setCondition,weatherProfiles.map(p=>p.id)],['Phase',phase,setPhase,['day','night']],['Wind',wind,setWind,['calm','breezy','strong','high','severe']],['Data state',status,setStatus,['live','cached','stale','offline','provider-unavailable','permission-denied']]].map(([label,value,set,options])=><SelectField key={label as string} label={label as string} value={value as string} onChange={set as (s:string)=>void} options={(options as string[]).map(value=>({value,label:value.replaceAll('-',' ')}))}/>)}<label className="row"><Switch checked={reduced} onCheckedChange={setReduced}/>Reduced motion</label></div>{status==='permission-denied'?<p className="review-disclosure">Reviewer observation: the permission-controlled weather surface is not rendered.</p>:<Atmosphere condition={condition} phase={phase} wind={wind} status={status} fixture/>}<div className="weather-condition-grid">{weatherProfiles.map(p=><button key={p.id} aria-pressed={condition===p.id} onClick={()=>setCondition(p.id)}><span>{String(weatherProfiles.indexOf(p)+1).padStart(2,'0')}</span>{p.label}</button>)}</div></section>}
export default function ExperienceLabs(props:WorkspaceProps){
  const {route,person}=props;
  const options=metricWidgetCatalog.filter(widget=>has(person,widget.permission)&&canPage(person,widget.route));
  const initial=options.slice(0,6).map(widget=>({id:widget.id,visible:true,size:'Standard',collapsed:false}));
  const [widgets,setWidgets]=useState(()=>widgetLayout.get(person.id)||initial),[saved,setSaved]=useState(initial),[notice,setNotice]=useState(''),[choice,setChoice]=useState(options[0]?.id||''),[dragged,setDragged]=useState<string|null>(null);
  if(!canPage(person,route))return null;
  if(route==='weather-lab')return <WeatherLab/>;
  if(route==='clock-admin')return <GlobalOperations admin/>;
  const allowed=widgets.filter(w=>options.some(option=>option.id===w.id));
  const move=(id:string,d:number)=>{setWidgets(a=>{const b=[...a],i=b.findIndex(w=>w.id===id),j=i+d;if(j>=0&&j<b.length)[b[i],b[j]]=[b[j],b[i]];return b})};
  return <section className="widget-studio metric-widget-studio" data-zero-click="widget-studio">
    <header><span className="eyebrow">AUTHORIZED INFORMATION WIDGETS</span><h2>Your operational pulse, arranged around your work.</h2><p>Every tile exposes a primary value or truthful unavailable state. Layout changes never grant permission.</p></header>
    <div className="row wrap mt"><SelectField label="Add authorized widget" value={choice} onChange={setChoice} options={options.map(widget=>({value:widget.id,label:widget.label}))}/><Btn onClick={()=>{if(options.some(widget=>widget.id===choice)&&!widgets.some(w=>w.id===choice))setWidgets(a=>[...a,{id:choice,visible:true,size:'Standard',collapsed:false}])}}>Add</Btn><Btn primary onClick={()=>{setSaved(widgets);widgetLayout.save(person.id,widgets);setNotice('Authorized metric-widget layout saved for this review session.')}}>Save layout</Btn><Btn onClick={()=>{setWidgets(saved);setNotice('Restored saved sample layout')}}>Restore saved</Btn><Btn onClick={()=>setWidgets(initial)}>Reset</Btn></div>
    <p role="status">{notice}</p>
    <div className="widget-canvas">{allowed.map(w=>{const definition=options.find(option=>option.id===w.id)!;return <div key={w.id} draggable onDragStart={()=>setDragged(w.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged&&dragged!==w.id)setWidgets(a=>{const b=[...a],i=b.findIndex(x=>x.id===dragged),j=b.findIndex(x=>x.id===w.id);if(i>=0&&j>=0)[b[i],b[j]]=[b[j],b[i]];return b});setDragged(null)}} className={w.size==='Wide'?'widget-tile wide':'widget-tile'}>
      <Panel title={definition.label} className={`metric-widget widget-tile ${w.size==='Wide'?'wide':''}`}><div className="row wrap metric-widget-controls"><Btn small onClick={()=>move(w.id,-1)}>Earlier</Btn><Btn small onClick={()=>move(w.id,1)}>Later</Btn><Btn small onClick={()=>setWidgets(a=>a.map(x=>x.id===w.id?{...x,size:x.size==='Wide'?'Standard':'Wide'}:x))}>Resize: {w.size}</Btn><Btn small onClick={()=>setWidgets(a=>a.map(x=>x.id===w.id?{...x,collapsed:!x.collapsed}:x))}>{w.collapsed?'Expand':'Collapse'}</Btn><Btn small onClick={()=>setWidgets(a=>a.map(x=>x.id===w.id?{...x,visible:!x.visible}:x))}>{w.visible?'Hide':'Show'}</Btn><Btn small onClick={()=>{if(options.some(option=>option.id===choice)&&!widgets.some(x=>x.id===choice))setWidgets(a=>a.map(x=>x.id===w.id?{...x,id:choice}:x));else setNotice('Choose another permitted information widget.')}}>Replace</Btn><Btn small onClick={()=>setWidgets(a=>a.filter(x=>x.id!==w.id))}>Remove</Btn></div>{w.visible&&!w.collapsed&&<div className="metric-widget-preview" data-accent={definition.accent}><span>SAMPLE / AUTHORIZED SCOPE</span><strong>{definition.value}</strong><small>{definition.status}</small><p>{definition.description}</p><Btn onClick={()=>props.go(definition.route)}>Open detail</Btn></div>}</Panel>
    </div>})}</div>
    <p>Drag to exchange positions, or use Earlier/Later. The preview is session-only; durable preferences and live metrics require backend integration.</p>
  </section>
}
