"use client";

import React,{useEffect,useId,useMemo,useState} from "react";
import {
  ResponsiveContainer,AreaChart,Area,LineChart,Line,BarChart,Bar,XAxis,YAxis,
  CartesianGrid,Tooltip,ReferenceLine,Brush,
} from "recharts";
import {chartData} from "@/lib/portal-model";
import {DataTable} from "./Common";
import MetricKpi from "./analytics-intelligence/MetricKpi";
import {unavailableEggsCollected} from "./analytics-intelligence/egg-collection";
import type {MetricScope} from "./analytics-intelligence/metric-contract";

type ChartKind="eggs"|"feed"|"finance"|"profit"|"cost";
type ChartRow=Record<string,string|number|undefined> & {day:string};
type PremiumTooltipProps={
  active?:boolean;
  label?:string|number;
  payload?:readonly {value?:number|string;name?:string;dataKey?:string|number}[];
  unit:string;
  sample:boolean;
};

function PremiumTooltip({active,label,payload,unit,sample}:PremiumTooltipProps){
  if(!active||!payload?.length)return null;
  return <div className="premium-chart-tooltip">
    <div className="premium-chart-tooltip-head"><strong>{String(label||"")}</strong>{sample&&<span>Sample</span>}</div>
    <div className="premium-chart-tooltip-values">{payload.filter(item=>typeof item.value==="number").map((item,index)=><div key={`${String(item.dataKey)}-${index}`}><span>{item.name||String(item.dataKey)}</span><strong>{Number(item.value).toLocaleString()} {unit}</strong></div>)}</div>
    <small>Click to pin this point for comparison.</small>
  </div>;
}

function activeLabelFromState(state:unknown){
  if(!state||typeof state!=="object")return null;
  const candidate=(state as {activeLabel?:unknown}).activeLabel;
  return typeof candidate==="string"||typeof candidate==="number"?String(candidate):null;
}

// kpiScope must come from the parent that holds the verified farm context. Without it the KPI withholds all values.
const UNVERIFIED_SCOPE:MetricScope={level:"farm",label:"Farm scope not verified",authorized:false};
export default function Chart({kind="eggs",period="Week",kpiScope=UNVERIFIED_SCOPE}:{kind?:ChartKind;period?:string;kpiScope?:MetricScope}){
  const chartId=useId();
  const titleId=`${chartId}-title`;
  const detailId=`${chartId}-detail`;
  const tableId=`${chartId}-table`;
  const [table,setTable]=useState(false);
  const [pinnedLabel,setPinnedLabel]=useState<string|null>(null);
  const [hiddenSeries,setHiddenSeries]=useState<string[]>([]);
  const [reducedMotion,setReducedMotion]=useState(false);
  // No verified egg-collection source is connected to this chart yet, so the KPI reports the missing source rather than a total.
  const eggsKpi=useMemo(()=>unavailableEggsCollected(kpiScope,{label:period,start:null,end:null}),[kpiScope,period]);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-reduced-motion: reduce)");
    const update=()=>setReducedMotion(media.matches);
    update(); media.addEventListener("change",update);
    return()=>media.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    setHiddenSeries([]);
    setPinnedLabel(null);
  },[kind,period]);

  const data=useMemo<ChartRow[]>(()=>period==="Today"?[
    {day:"8 AM",eggs:812,feed:120,income:140,expense:100},
    {day:"10 AM",eggs:900,feed:130,income:120,expense:60},
    {day:"12 PM",eggs:1000,feed:110,income:160,expense:50},
    {day:"2 PM",eggs:900,feed:120,income:140,expense:100},
  ]:period==="Month"?[
    {day:"Week 1",eggs:23800,feed:3300,income:3120,expense:2090},
    {day:"Week 2",eggs:24427,feed:3331,income:3475,expense:2135},
    {day:"Week 3",eggs:24610,feed:3350,income:3510,expense:2280},
    {day:"Week 4",eggs:24720,feed:3370,income:3610,expense:2400},
  ]:chartData as ChartRow[],[period]);

  const profitData=useMemo<ChartRow[]>(()=>[
    {day:"Apr",actual:120},{day:"May",actual:152},{day:"Jun",actual:146},{day:"Jul",actual:180},
    {day:"Aug",actual:210,projected:200},{day:"Sep",projected:225},{day:"Oct",projected:245},
  ],[]);

  const plottedData=kind==="profit"?profitData:data;
  const keys=kind==="eggs"?["eggs"]:kind==="feed"?["feed"]:kind==="cost"?["expense"]:["income","expense"];
  const unit=kind==="eggs"?"eggs":kind==="feed"?"kg":"₦ thousands";
  const series=kind==="finance"?[
    {key:"income",label:"Income"},
    {key:"expense",label:"Expense"},
  ]:kind==="profit"?[
    {key:"actual",label:"Actual"},
    {key:"projected",label:"Projection"},
  ]:[];
  const visibleSeries=series.filter(item=>!hiddenSeries.includes(item.key));
  const seriesVisible=(key:string)=>!hiddenSeries.includes(key);
  const toggleSeries=(key:string)=>{
    setHiddenSeries(current=>{
      const hiding=!current.includes(key);
      if(hiding&&series.length-current.length<=1)return current;
      return hiding?[...current,key]:current.filter(item=>item!==key);
    });
  };
  const axis={tickLine:false,axisLine:false,tick:{fontSize:12,fill:"#667b6d"}};
  const grid=<CartesianGrid vertical={false} stroke="#e2e9df" strokeDasharray="3 4"/>;
  const tooltip=<Tooltip content={<PremiumTooltip unit={unit} sample/>} cursor={{stroke:"#2f78a8",strokeWidth:1,strokeDasharray:"4 4"}}/>;
  const pinned=pinnedLabel?<ReferenceLine x={pinnedLabel} stroke="#2f78a8" strokeWidth={1.5} strokeDasharray="3 3"/>:null;
  const animate=!reducedMotion;
  const onPointClick=(state:unknown)=>{const next=activeLabelFromState(state);if(next)setPinnedLabel(current=>current===next?null:next);};
  const showBrush=plottedData.length>=7;
  const brush=showBrush?<Brush dataKey="day" height={24} travellerWidth={8} stroke="#557f70" fill="#f4f7f5"/>:null;

  return <>
    {kind==="eggs"&&<MetricKpi metric={eggsKpi} variant="inline"/>}
    <div className="chart-holder premium-chart-shell" role="group" aria-labelledby={titleId} aria-describedby={detailId}>
      <span id={titleId} className="sr-only">{kind} sample {kind==="profit"?"April–October":period.toLowerCase()} chart · {unit}</span>
      <span id={detailId} className="sr-only">SAMPLE / DESIGN DATA. Use keyboard-accessible series controls when available, or open the data table for every plotted value. Chart points may be pinned for comparison.</span>
      <ResponsiveContainer width="100%" height="100%">
        {kind==="feed"||kind==="cost"?<BarChart data={data} margin={{top:8,right:8,left:-10,bottom:0}} onClick={onPointClick} accessibilityLayer>
          {grid}<XAxis dataKey="day" {...axis}/><YAxis {...axis}/>{tooltip}{pinned}
          <Bar dataKey={kind==="feed"?"feed":"expense"} name={kind==="feed"?"Feed":"Expense"} fill="#438461" radius={[5,5,0,0]} maxBarSize={40} isAnimationActive={animate} animationDuration={420}/>
        </BarChart>:kind==="finance"?<BarChart data={data} margin={{top:8,right:8,left:-10,bottom:0}} onClick={onPointClick} accessibilityLayer>
          {grid}<XAxis dataKey="day" {...axis}/><YAxis {...axis}/>{tooltip}{pinned}
          {seriesVisible("income")&&<Bar dataKey="income" name="Income" fill="#327653" radius={[4,4,0,0]} isAnimationActive={animate} animationDuration={420}/>}
          {seriesVisible("expense")&&<Bar dataKey="expense" name="Expense" fill="#c4ac63" radius={[4,4,0,0]} isAnimationActive={animate} animationDuration={420}/>}
        </BarChart>:

        kind==="profit"?<LineChart data={profitData} onClick={onPointClick} syncId="daenem-finance-time" accessibilityLayer>
          {grid}<XAxis dataKey="day" {...axis}/><YAxis {...axis}/>{tooltip}{pinned}
          {seriesVisible("actual")&&<Line type="monotone" dataKey="actual" name="Actual" stroke="#327653" strokeWidth={3} dot={{r:3}} activeDot={{r:6,strokeWidth:2}} isAnimationActive={animate} animationDuration={450}/>}
          {seriesVisible("projected")&&<Line type="monotone" dataKey="projected" name="Projection" stroke="#b08e39" strokeWidth={3} strokeDasharray="7 6" dot={{r:3}} activeDot={{r:6,strokeWidth:2}} isAnimationActive={animate} animationDuration={450}/>}
          {brush}
        </LineChart>:<AreaChart data={data} margin={{top:8,right:8,left:-10,bottom:0}} onClick={onPointClick} syncId={`daenem-operations-${period}`} accessibilityLayer>
          <defs><linearGradient id="eggGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78a269" stopOpacity={.32}/><stop offset="100%" stopColor="#78a269" stopOpacity={0}/></linearGradient></defs>
          {grid}<XAxis dataKey="day" {...axis}/><YAxis {...axis} domain={["dataMin - 150","dataMax + 150"]}/>{tooltip}{pinned}
          <Area type="monotone" dataKey="eggs" name="Collected" stroke="#4f8358" strokeWidth={2.7} fill="url(#eggGradient)" activeDot={{r:6,strokeWidth:2}} isAnimationActive={animate} animationDuration={450}/>
          {brush}
        </AreaChart>}
      </ResponsiveContainer>
    </div>
    <div className="chart-footer premium-chart-footer">
      <span className="premium-chart-source"><strong>SAMPLE / DESIGN DATA</strong> · {kind==="profit"?"Apr–Oct 2026":period.toLowerCase()} · {unit}</span>
      <div className="premium-chart-actions">
        {series.length>1&&<div className="premium-chart-series" role="group" aria-label="Visible chart series">
          {series.map(item=>{
            const visible=seriesVisible(item.key);
            const onlyVisible=visible&&visibleSeries.length===1;
            return <button
              key={item.key}
              type="button"
              className="chart-series-toggle"
              data-series={item.key}
              aria-pressed={visible}
              disabled={onlyVisible}
              onClick={()=>toggleSeries(item.key)}
              title={onlyVisible?"At least one chart series must remain visible":undefined}
            ><i aria-hidden="true"/><span>{item.label}</span></button>;
          })}
        </div>}
        {pinnedLabel&&<button className="chart-pin" onClick={()=>setPinnedLabel(null)} aria-label={`Clear pinned chart point ${pinnedLabel}`}>Pinned: {pinnedLabel} ×</button>}
        <button className="link-button" aria-expanded={table} aria-controls={tableId} onClick={()=>setTable(!table)}>{table?"Hide Data Table":"Show Data Table"}</button>
      </div>
    </div>

    {table&&<div id={tableId} role="region" aria-label={`${kind} chart data table`}>
      <DataTable
        headers={kind==="profit"?["Month","Actual (₦000)","Projected (₦000)"]:["Day",...keys.map(k=>`${k} (${unit})`)]}
        rows={kind==="profit"?[["Apr",120,"—"],["May",152,"—"],["Jun",146,"—"],["Jul",180,"—"],["Aug",210,200],["Sep","—",225],["Oct","—",245]]:data.map(d=>[d.day,...keys.map(k=>d[k]??"—")])}
      />
    </div>}
  </>;
}
