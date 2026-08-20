"use client";

import {ReactNode,useState} from "react";
import {Localized} from "./language-provider";

export type WorkbenchTab={id:"principle"|"step"|"history"|"parameters";label:string;content:ReactNode};

export default function AlgorithmWorkbench({title,subtitle,accent="green",tabs}:{title:string;subtitle:string;accent?:"green"|"blue"|"gold";tabs:WorkbenchTab[]}){
  const[teaching,setTeaching]=useState(true);
  const[active,setActive]=useState<WorkbenchTab["id"]>("step");
  const current=tabs.find(t=>t.id===active)??tabs[0];
  return <Localized><section className={`algorithm-workbench ${accent}`} aria-label={`${title}算法解析`}>
    <header className="workbench-head">
      <div><span>ALGORITHM EXPLAINER</span><h2>{title}</h2><p>{subtitle}</p></div>
      <div className="mode-switch" aria-label="显示模式"><button className={!teaching?"active":""} onClick={()=>setTeaching(false)}>实验模式</button><button className={teaching?"active":""} onClick={()=>setTeaching(true)}>教学模式</button></div>
    </header>
    {!teaching?<div className="workbench-collapsed"><b>实验模式已启用</b><p>模拟保持完整运行；切换到教学模式可查看公式、本步决策和历史快照。</p><button onClick={()=>setTeaching(true)}>展开算法解析 →</button></div>:<>
      <nav className="workbench-tabs" aria-label="算法解析栏目">{tabs.map(t=><button key={t.id} className={active===t.id?"active":""} onClick={()=>setActive(t.id)}>{t.label}</button>)}</nav>
      <div className="workbench-content" key={current.id}>{current.content}</div>
    </>}
  </section></Localized>;
}

export function Formula({children,note}:{children:ReactNode;note?:string}){return <div className="formula-card"><code>{children}</code>{note&&<span>{note}</span>}</div>}
export function ProcessFlow({steps}:{steps:string[]}){return <Localized><ol className="process-flow" aria-label="算法运算步骤">{steps.map((s,i)=><li key={s}><span>步骤 {i+1}</span><b>{s}</b>{i<steps.length-1&&<i aria-hidden="true">→</i>}</li>)}</ol></Localized>}
export function CalcGrid({items}:{items:{label:string;value:string|number;hint?:string;tone?:"good"|"warn"}[]}){return <div className="calc-grid">{items.map(x=><div key={x.label} className={x.tone??""}><span>{x.label}</span><b>{x.value}</b>{x.hint&&<small>{x.hint}</small>}</div>)}</div>}
export function ParamList({items}:{items:{symbol:string;name:string;effect:string}[]}){return <div className="parameter-list">{items.map(x=><div key={x.symbol}><code>{x.symbol}</code><b>{x.name}</b><p>{x.effect}</p></div>)}</div>}
export function HistoryScrubber({value,max,onChange,label,children}:{value:number;max:number;onChange:(n:number)=>void;label:string;children:ReactNode}){return <Localized><div className="history-scrubber"><div className="scrubber-top"><b>历史快照</b><span>{label}</span></div><input aria-label="历史回放位置" type="range" min={0} max={Math.max(0,max)} value={Math.min(value,max)} onChange={e=>onChange(+e.target.value)}/>{children}<p className="history-note">这里只回看记录，不会改变当前实验状态。</p></div></Localized>}
