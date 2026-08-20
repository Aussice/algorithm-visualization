"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AlgorithmWorkbench,{CalcGrid,Formula,HistoryScrubber,ParamList,ProcessFlow} from "./algorithm-workbench";
import {Localized} from "./language-provider";

type Action = "C" | "D";
type Genome = [number, number, number, number, number];
type Agent = { id:number; genome:Genome; x:number; y:number; score:number; action?:Action; opponent?:number; age:number; isNew?:boolean };
type Snapshot = { generation:number; population:number; cooperation:number; payoff:number; births:number; deaths:number };
type EvoTrace = {generation:number;pair:string;actions:string;pairPayoff:string;cooperation:number;avgPayoff:number;births:number;deaths:number;nextPopulation:number};

const COLORS:Record<string,string> = {"以牙还牙":"#3f8068","永远合作":"#d3a14f","永远背叛":"#bd5b4c","赢留输变":"#577c9a","混合策略":"#88719b"};
const PROTOTYPES:{name:string;genome:Genome}[] = [
  {name:"以牙还牙",genome:[1,1,0,1,0]},
  {name:"永远合作",genome:[1,1,1,1,1]},
  {name:"永远背叛",genome:[0,0,0,0,0]},
  {name:"赢留输变",genome:[1,1,0,0,1]},
];
const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));
const randn=()=>Math.sqrt(-2*Math.log(Math.max(Math.random(),1e-8)))*Math.cos(2*Math.PI*Math.random());
const seeded=(seed:number)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const strategyName=(g:Genome)=>{
  let best={name:"混合策略",d:.52};
  for(const p of PROTOTYPES){const d=Math.sqrt(p.genome.reduce((s,x,i)=>s+(x-g[i])**2,0)/5);if(d<best.d)best={name:p.name,d};}
  return best.name;
};
let nextId=1000;
const pointFor=(index:number,total:number,rng:()=>number=Math.random)=>{const golden=Math.PI*(3-Math.sqrt(5));const a=index*golden+(rng()-.5)*.08;const r=38*Math.sqrt((index+.6)/Math.max(total,1));return{x:50+Math.cos(a)*r,y:50+Math.sin(a)*r*.82};};

function makePopulation(n:number,mode="balanced",rng:()=>number=Math.random,fixedIds=false):Agent[]{
  const weights=mode==="defectors"?[.12,.08,.7,.07,.03]:mode==="reciprocity"?[.56,.12,.12,.16,.04]:[.3,.2,.25,.15,.1];
  return Array.from({length:n},(_,i)=>{
    let r=rng(),idx=0;while(idx<weights.length-1&&(r-=weights[idx])>0)idx++;
    const base:Genome=idx<4?[...PROTOTYPES[idx].genome] as Genome:[rng(),rng(),rng(),rng(),rng()];
    const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(rng(),1e-8)))*Math.cos(2*Math.PI*rng());
    const genome=base.map(v=>clamp(v+gaussian()*.035)) as Genome;
    return{id:fixedIds?i+1:nextId++,genome,...pointFor(i,n,rng),score:0,age:0};
  });
}
function weightedPick(agents:Agent[],weights:number[]){let r=Math.random()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<agents.length;i++)if((r-=weights[i])<=0)return agents[i];return agents[agents.length-1];}
function countStrategies(agents:Agent[]){
  const out:Record<string,number>=Object.fromEntries(Object.keys(COLORS).map(k=>[k,0]));
  agents.forEach(a=>out[strategyName(a.genome)]++);
  return out;
}

function LineChart({data,field,color,max}:{data:Snapshot[];field:"population"|"cooperation";color:string;max?:number}){
  const values=data.slice(-60).map(d=>d[field]);const hi=max??Math.max(10,...values)*1.08;
  const pts=values.map((v,i)=>`${(i/Math.max(1,values.length-1))*100},${70-(v/hi)*62}`).join(" ");
  const area=values.length?`0,70 ${pts} 100,70`:"";
  return <svg viewBox="0 0 100 72" preserveAspectRatio="none" className="chart-svg" role="img" aria-label={`${field}变化图`}>
    {[16,34,52,70].map(y=><line key={y} x1="0" x2="100" y1={y} y2={y} className="chart-grid"/>)}
    <polygon points={area} fill={color} opacity=".08"/><polyline points={pts} fill="none" stroke={color} strokeWidth="1.7" vectorEffect="non-scaling-stroke"/>
    {values.length>0&&<circle cx="100" cy={70-(values.at(-1)!/hi)*62} r="1.8" fill={color}/>}
  </svg>;
}

export default function SimulationLab(){
  const[initialPopulation,setInitialPopulation]=useState(96);
  const[carryingCapacity,setCarryingCapacity]=useState(160);
  const[mutation,setMutation]=useState(.035);
  const[selection,setSelection]=useState(1.4);
  const[rounds,setRounds]=useState(8);
  const[temptation,setTemptation]=useState(5);
  const[noise,setNoise]=useState(.015);
  const[speed,setSpeed]=useState(620);
  const[running,setRunning]=useState(false);
  const[generation,setGeneration]=useState(0);
  const[agents,setAgents]=useState<Agent[]>(()=>makePopulation(96,"balanced",seeded(20260817),true));
  const[history,setHistory]=useState<Snapshot[]>([{generation:0,population:96,cooperation:0,payoff:0,births:0,deaths:0}]);
  const[trace,setTrace]=useState<EvoTrace>({generation:0,pair:"等待首次配对",actions:"-",pairPayoff:"-",cooperation:0,avgPayoff:0,births:0,deaths:0,nextPopulation:96});
  const[replayIndex,setReplayIndex]=useState(0);
  const[selectedId,setSelectedId]=useState<number|null>(null);
  const[event,setEvent]=useState("实验已就绪 · 等待开始");
  const[showSummary,setShowSummary]=useState(false);
  const[copied,setCopied]=useState(false);
  const agentsRef=useRef(agents),genRef=useRef(generation);
  const baselineDistributionRef=useRef(countStrategies(agents));
  useEffect(()=>{agentsRef.current=agents},[agents]);useEffect(()=>{genRef.current=generation},[generation]);

  const step=useCallback(()=>{
    const current=agentsRef.current;if(current.length<2){setRunning(false);setEvent("种群灭绝 · 请重置实验");return;}
    const shuffled=[...current].sort(()=>Math.random()-.5);
    let coop=0,actions=0;
    const scored=shuffled.map(a=>({...a,score:0,action:undefined,opponent:undefined} as Agent));
    for(let i=0;i+1<scored.length;i+=2){
      const a=scored[i],b=scored[i+1];let prevA:Action|undefined,prevB:Action|undefined;
      for(let turn=0;turn<rounds;turn++){
        const indexA=!prevA?0:prevA==="C"?(prevB==="C"?1:2):(prevB==="C"?3:4);
        const indexB=!prevB?0:prevB==="C"?(prevA==="C"?1:2):(prevA==="C"?3:4);
        let actA:Action=Math.random()<a.genome[indexA]?"C":"D",actB:Action=Math.random()<b.genome[indexB]?"C":"D";
        if(Math.random()<noise)actA=actA==="C"?"D":"C";if(Math.random()<noise)actB=actB==="C"?"D":"C";
        coop+=(actA==="C"?1:0)+(actB==="C"?1:0);actions+=2;
        if(actA==="C"&&actB==="C"){a.score+=3;b.score+=3}else if(actA==="D"&&actB==="D"){a.score+=1;b.score+=1}else if(actA==="D"){a.score+=temptation}else{b.score+=temptation}
        prevA=actA;prevB=actB;
      }
      a.action=prevA;b.action=prevB;a.opponent=b.id;b.opponent=a.id;
    }
    const avgPayoff=scored.reduce((s,a)=>s+a.score/rounds,0)/scored.length,cooperation=actions?coop/actions*100:0;
    const sampleA=scored[0],sampleB=scored[1];
    const growth=.18*(avgPayoff/3)*(1-scored.length/(carryingCapacity*1.2));
    const deathRate=.055+(scored.length>carryingCapacity?.08*(scored.length/carryingCapacity-1):0);
    const nextN=Math.max(0,Math.min(Math.round(carryingCapacity*1.25),Math.round(scored.length*(1+growth-deathRate+randn()*.008))));
    const fitness=scored.map(a=>Math.max(.015,Math.exp(selection*((a.score/rounds)-avgPayoff)/3)));
    const survivorN=Math.min(scored.length,nextN,Math.round(nextN*.72)),pool=scored.map((a,i)=>({a,w:fitness[i]})),survivors:Agent[]=[];
    while(survivors.length<survivorN&&pool.length){let r=Math.random()*pool.reduce((s,x)=>s+x.w,0),pick=0;for(;pick<pool.length-1;pick++)if((r-=pool[pick].w)<=0)break;survivors.push({...pool[pick].a,age:pool[pick].a.age+1});pool.splice(pick,1)}
    const offspring:Agent[]=[];
    while(survivors.length+offspring.length<nextN){
      const p1=weightedPick(scored,fitness),p2=weightedPick(scored,fitness);
      const genome=p1.genome.map((g,i)=>{let v=Math.random()<.5?g:p2.genome[i];if(Math.random()<mutation)v+=randn()*.16;return clamp(v)}) as Genome;
      offspring.push({id:nextId++,genome,x:50,y:50,score:0,age:0,isNew:true});
    }
    const births=offspring.length,deaths=scored.length-survivors.length;
    const nextAgents=[...survivors,...offspring].map((a,i)=>({...a,...pointFor(i,nextN)}));
    const nextGen=genRef.current+1,snap={generation:nextGen,population:nextN,cooperation,payoff:avgPayoff,births,deaths};
    setAgents(nextAgents);setGeneration(nextGen);setHistory(h=>{const next=[...h,snap];setReplayIndex(next.length-1);return next});setTrace({generation:nextGen,pair:sampleA&&sampleB?`#${sampleA.id} × #${sampleB.id}`:"无有效配对",actions:sampleA&&sampleB?`${sampleA.action??"-"} / ${sampleB.action??"-"}`:"-",pairPayoff:sampleA&&sampleB?`${(sampleA.score/rounds).toFixed(2)} / ${(sampleB.score/rounds).toFixed(2)}`:"-",cooperation,avgPayoff,births,deaths,nextPopulation:nextN});setEvent(`G${nextGen} · ${births} 次出生 / ${deaths} 次死亡 · 合作率 ${cooperation.toFixed(1)}%`);
  },[rounds,noise,temptation,carryingCapacity,selection,mutation]);

  useEffect(()=>{if(!running)return;const timer=window.setInterval(step,speed);return()=>window.clearInterval(timer)},[running,speed,step]);
  useEffect(()=>{if(!showSummary)return;const close=(e:KeyboardEvent)=>{if(e.key==="Escape")setShowSummary(false)};window.addEventListener("keydown",close);return()=>window.removeEventListener("keydown",close)},[showSummary]);
  const reset=useCallback((mode="balanced")=>{const pop=makePopulation(initialPopulation,mode);baselineDistributionRef.current=countStrategies(pop);setAgents(pop);setGeneration(0);setRunning(false);setSelectedId(null);setShowSummary(false);setHistory([{generation:0,population:pop.length,cooperation:0,payoff:0,births:0,deaths:0}]);setReplayIndex(0);setTrace({generation:0,pair:"等待首次配对",actions:"-",pairPayoff:"-",cooperation:0,avgPayoff:0,births:0,deaths:0,nextPopulation:pop.length});setEvent(mode==="balanced"?"实验已重置":`已载入预设 · ${mode}`)},[initialPopulation]);
  const latest=history.at(-1)!,previous=history.at(-2),selected=agents.find(a=>a.id===selectedId)??agents[0];
  const distribution=useMemo(()=>countStrategies(agents),[agents]);
  const summary=useMemo(()=>{
    const records=history.slice(1);
    if(!records.length)return null;
    const startPop=history[0].population,endPop=latest.population,popDelta=endPop-startPop,popPct=startPop?popDelta/startPop*100:0;
    const avgCoop=records.reduce((s,d)=>s+d.cooperation,0)/records.length;
    const avgPayoff=records.reduce((s,d)=>s+d.payoff,0)/records.length;
    const peakPop=records.reduce((a,b)=>b.population>a.population?b:a),lowPop=records.reduce((a,b)=>b.population<a.population?b:a);
    const highCoop=records.reduce((a,b)=>b.cooperation>a.cooperation?b:a),lowCoop=records.reduce((a,b)=>b.cooperation<a.cooperation?b:a);
    const window=Math.min(5,Math.max(1,Math.floor(records.length/2)));
    const firstAvg=records.slice(0,window).reduce((s,d)=>s+d.cooperation,0)/window;
    const lastAvg=records.slice(-window).reduce((s,d)=>s+d.cooperation,0)/window;
    const coopDelta=lastAvg-firstAvg;
    const variance=records.reduce((s,d)=>s+(d.cooperation-avgCoop)**2,0)/records.length;
    const volatility=Math.sqrt(variance);
    const dominant=(dist:Record<string,number>,total:number)=>{
      const [name,count]=Object.entries(dist).sort((a,b)=>b[1]-a[1])[0]??["无",0] as [string,number];
      return{name,share:total?count/total*100:0};
    };
    const initialDominant=dominant(baselineDistributionRef.current,startPop),currentDominant=dominant(distribution,endPop);
    const coopState=coopDelta>8?"显著上升":coopDelta<-8?"显著下降":"大体稳定";
    const popState=popPct>10?"扩张":popPct<-10?"收缩":"基本稳定";
    const title=coopDelta>8&&popPct>0?"互惠合作推动了种群扩张":coopDelta<-8&&popPct<0?"合作退潮伴随种群收缩":coopDelta>8?"合作正在建立，但尚未转化为规模增长":coopDelta<-8?"背叛行为扩张，种群仍在承受其代价":volatility>14?"多种策略形成了高波动共存":"种群进入相对稳定的策略平衡";
    const findings:string[]=[];
    if(rounds>=10&&coopDelta>5)findings.push(`${rounds} 轮重复相遇扩大了未来回报，当前结果与互惠策略受益的机制一致。`);
    if(temptation>=5.8&&coopDelta<0)findings.push(`背叛诱惑 T=${temptation.toFixed(1)} 明显高于合作奖励，短期欺骗优势可能压低了合作。`);
    if(noise>=.06)findings.push(`${(noise*100).toFixed(1)}% 的行动噪声会制造误判；当前波动中可能包含连续报复造成的合作破裂。`);
    if(mutation>=.1)findings.push(`${(mutation*100).toFixed(1)}% 的高突变率持续制造新策略，使种群更难完全收敛。`);
    if(selection>=2&&currentDominant.share>=60)findings.push(`较强选择压力 β=${selection.toFixed(1)} 放大了收益差距，加速了“${currentDominant.name}”的扩张。`);
    if(currentDominant.name==="永远背叛"&&latest.cooperation<35)findings.push("永远背叛成为主要表型，与当前低合作率相互印证；但背叛者之间只能获得较低的相互背叛收益。");
    if((currentDominant.name==="以牙还牙"||currentDominant.name==="赢留输变")&&latest.cooperation>60)findings.push(`${currentDominant.name}成为主要表型，说明有条件的互惠而非无条件合作支撑了当前合作水平。`);
    if(!findings.length)findings.push("目前没有单一参数足以解释结果；更可能是初始构成、随机配对和遗传漂变共同作用。");
    const reportText=`演化实验总结｜第 0-${generation} 代\n\n${title}\n\n种群：${startPop} → ${endPop}（${popDelta>=0?"+":""}${popDelta}，${popPct>=0?"+":""}${popPct.toFixed(1)}%）\n平均合作率：${avgCoop.toFixed(1)}%\n平均收益：${avgPayoff.toFixed(2)}\n优势策略：${initialDominant.name} → ${currentDominant.name}（当前 ${currentDominant.share.toFixed(1)}%）\n最高合作率：第 ${highCoop.generation} 代，${highCoop.cooperation.toFixed(1)}%\n种群峰值：第 ${peakPop.generation} 代，${peakPop.population} 个体\n\n可能机制：\n${findings.map((x,i)=>`${i+1}. ${x}`).join("\n")}`;
    return{title,avgCoop,avgPayoff,popDelta,popPct,popState,coopState,volatility,peakPop,lowPop,highCoop,lowCoop,initialDominant,currentDominant,findings,reportText};
  },[history,latest,distribution,generation,rounds,temptation,noise,mutation,selection]);
  const pairLines=agents.filter(a=>a.opponent&&a.id<a.opponent).slice(0,28).map(a=>[a,agents.find(b=>b.id===a.opponent)!] as const).filter(x=>x[1]);
  const replay=history[Math.min(replayIndex,history.length-1)]??history[0];

  return <Localized><main className="lab-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark"/>算法可视化实验室</Link><nav className="topnav"><a href="#lab">模拟器</a><a href="#model">模型说明</a><a href="#references">研究依据</a></nav><div className="topbar-actions"><div className="generation-pill">GEN <b>{String(generation).padStart(3,"0")}</b></div><Link href="/" className="exit-lab"><span className="exit-symbol">←</span><span><b>退出实验</b><small>返回目录</small></span></Link></div></header>
    <section className="intro"><div><p className="eyebrow">Evolutionary Game Theory · Live Laboratory</p><h1>合作，如何在背叛中<br/>演化出来？</h1><p>每个圆点都是携带策略基因的个体。它们反复相遇、合作或背叛；收益决定谁更可能存活并留下后代，交叉与突变则不断制造新的行为。</p></div><div className="payoff-mini" aria-label="收益矩阵"><div><b>3 · 3</b>合作 / 合作</div><div><b>0 · {temptation}</b>合作 / 背叛</div><div><b>{temptation} · 0</b>背叛 / 合作</div><div><b>1 · 1</b>背叛 / 背叛</div></div></section>
    <section className="workspace" id="lab">
      <aside className="panel controls-panel"><div className="panel-head"><span className="panel-title">实验控制</span><span className="panel-note">参数实时生效</span></div><div className="control-body">
        <div className="run-controls"><button className="primary-btn" onClick={()=>setRunning(v=>!v)}>{running?"暂停演化":"开始演化"}</button><button className="icon-btn" onClick={step} aria-label="单步运行">›</button><button className="icon-btn" onClick={()=>reset()} aria-label="重置">↻</button></div>
        <Control label="初始种群" value={initialPopulation} min={30} max={180} step={2} onChange={setInitialPopulation} suffix=" 个"/>
        <Control label="环境承载量 K" value={carryingCapacity} min={60} max={260} step={10} onChange={setCarryingCapacity}/>
        <Control label="每次相遇轮数" value={rounds} min={2} max={20} step={1} onChange={setRounds} suffix=" 轮"/>
        <Control label="选择压力 β" value={selection} min={.2} max={3} step={.1} onChange={setSelection} digits={1}/>
        <Control label="基因突变率 μ" value={mutation*100} min={0} max={18} step={.5} onChange={v=>setMutation(v/100)} suffix="%" digits={1}/>
        <Control label="行动噪声 ε" value={noise*100} min={0} max={12} step={.5} onChange={v=>setNoise(v/100)} suffix="%" digits={1}/>
        <Control label="运行速度" value={speed} min={120} max={1200} step={60} onChange={setSpeed} display={`${(1000/speed).toFixed(1)} 代/秒`} reverse/>
        <div className="control-group"><div className="control-row"><label>情景预设</label></div><div className="preset-grid"><button className="preset" onClick={()=>reset("reciprocity")}>互惠占优</button><button className="preset" onClick={()=>reset("defectors")}>背叛入侵</button><button className="preset" onClick={()=>{setMutation(.13);reset()}}>高突变</button><button className="preset" onClick={()=>{setNoise(.09);reset()}}>高噪声</button></div></div>
        <div className="control-group"><div className="control-row"><label>囚徒困境收益</label><span className="control-value">T={temptation}</span></div><input aria-label="背叛诱惑收益" type="range" min="3.2" max="7" step=".1" value={temptation} onChange={e=>setTemptation(+e.target.value)}/><table className="matrix"><thead><tr><th></th><th>对方 C</th><th>对方 D</th></tr></thead><tbody><tr><th>自己 C</th><td>3, 3</td><td>0, {temptation}</td></tr><tr><th>自己 D</th><td>{temptation}, 0</td><td>1, 1</td></tr></tbody></table></div>
      </div></aside>
      <section className="panel arena-panel"><div className="panel-head"><span className="panel-title">个体交互场</span><div className="arena-head-actions"><span className={`live-dot ${running?"running":""}`}/><span className="panel-note">{running?"LIVE":"PAUSED"}</span></div></div><div className="arena-wrap">
        <svg viewBox="0 0 100 100" className="arena-svg" aria-label="种群个体互动可视化">
          {pairLines.map(([a,b])=><line key={`${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="pair-line"/>)}
          {agents.map(a=>{const name=strategyName(a.genome),radius=Math.max(1.05,Math.min(2.05,10/Math.sqrt(Math.max(agents.length,20))));return <g className="agent" key={a.id} transform={`translate(${a.x} ${a.y})`} onClick={()=>setSelectedId(a.id)} opacity={selectedId&&selectedId!==a.id?.58:1}>{a.isNew&&<circle r={radius+1.6} fill="none" stroke={COLORS[name]} opacity=".22"/>}<circle className="main" r={radius} fill={COLORS[name]} stroke={selectedId===a.id?"#14231e":"white"}/>{a.action&&<g transform={`translate(0 ${-radius-2.1})`}><circle r="1.45" fill={a.action==="C"?"#3f8068":"#bd5b4c"}/><text className="action-tag" y=".1">{a.action}</text></g>}</g>})}
        </svg></div><div className="arena-footer"><div className="legend"><strong>策略图例</strong>{Object.entries(COLORS).map(([n,c])=><span className="legend-item" key={n}><span className="legend-dot" style={{background:c}}/>{n}</span>)}</div><div className="event-log">{event}</div></div>
      </section>
      <aside className="panel stats-panel"><div className="panel-head"><span className="panel-title">种群状态</span><div className="stats-head-right"><span className="panel-note">第 {generation} 代</span><button className="summary-trigger" disabled={generation<3} onClick={()=>{setRunning(false);setCopied(false);setShowSummary(true)}}>总结本轮</button></div></div><div className="metrics">
        <Metric label="存活个体" value={latest.population} delta={previous?latest.population-previous.population:0}/><Metric label="合作率" value={`${latest.cooperation.toFixed(1)}%`} delta={previous?latest.cooperation-previous.cooperation:0}/><Metric label="平均收益" value={latest.payoff.toFixed(2)} delta={previous?latest.payoff-previous.payoff:0}/><Metric label="本代净变化" value={`${latest.population-(previous?.population??latest.population)>=0?"+":""}${latest.population-(previous?.population??latest.population)}`}/>
      </div><div className="chart-block"><div className="chart-top"><span className="chart-title">种群大小</span><span className="chart-legend">承载量 {carryingCapacity}</span></div><LineChart data={history} field="population" color="#3f8068" max={carryingCapacity*1.12}/></div><div className="chart-block"><div className="chart-top"><span className="chart-title">合作行为比例</span><span className="chart-legend">C / 全部行动</span></div><LineChart data={history} field="cooperation" color="#c8984c" max={100}/></div><div className="distribution"><div className="chart-top"><span className="chart-title">策略表型分布</span><span className="chart-legend">按最近原型归类</span></div>{Object.entries(distribution).map(([name,count])=><div className="dist-row" key={name}><span>{name}</span><div className="dist-track"><div className="dist-fill" style={{width:`${agents.length?count/agents.length*100:0}%`,background:COLORS[name]}}/></div><span className="dist-number">{agents.length?(count/agents.length*100).toFixed(0):0}%</span></div>)}</div></aside>
    </section>
    <section className="inspector" id="model"><div className="inspector-inner"><div><p className="eyebrow">Individual Inspector</p><h3>{selected?`个体 #${selected.id} · ${strategyName(selected.genome)}`:"点击一个个体查看基因"}</h3><p>基因不是固定标签，而是五个合作概率：第一次行动，以及上一轮四种结果后的下一步选择。表型名称只是与经典策略原型的最近距离。</p></div><div>{selected&&["初次","CC 后","CD 后","DC 后","DD 后"].map((label,i)=><div className="gene-row" key={label}><span>{label}</span><div className="gene-track"><div className="gene-fill" style={{width:`${selected.genome[i]*100}%`}}/></div><span>{selected.genome[i].toFixed(2)}</span></div>)}</div><div><p className="eyebrow">Generation Cycle</p><div className="model-flow"><span className="flow-node">随机配对</span><span className="flow-arrow">→</span><span className="flow-node">重复博弈</span><span className="flow-arrow">→</span><span className="flow-node">收益适应度</span><span className="flow-arrow">→</span><span className="flow-node">选择 · 交叉 · 突变</span></div></div></div></section>
    <AlgorithmWorkbench title="一代种群是怎样被计算出来的" subtitle="从一组真实配对开始，追踪合作行为、平均收益、选择权重与下一代规模。" tabs={[
      {id:"principle",label:"算法原理",content:<div className="workbench-split"><div><h3>每一代的演化循环</h3><ProcessFlow steps={["个体随机配对","进行多轮囚徒困境","累计收益并计算适应度","选择幸存者与亲本","交叉、突变并形成下一代"]}/></div><div><h3>收益如何变成繁殖机会</h3><Formula note="个体收益高于种群平均时，选择压力 β 会指数放大其权重。">wᵢ = exp[β · (πᵢ − π̄) / 3]</Formula><Formula note="种群越接近承载量 K，收益带来的增长越受环境抑制。">growth ∝ π̄ · (1 − N / 1.2K)</Formula></div></div>},
      {id:"step",label:"本代计算",content:<><div className="step-callout"><span>GENERATION {trace.generation}</span><b>示例配对 {trace.pair}</b><p>最后一轮行为：{trace.actions}　每轮平均收益：{trace.pairPayoff}</p></div><CalcGrid items={[{label:"全体合作率",value:`${trace.cooperation.toFixed(1)}%`,tone:trace.cooperation>=50?"good":undefined},{label:"平均收益",value:trace.avgPayoff.toFixed(2),hint:"每人每轮"},{label:"出生",value:trace.births,tone:"good"},{label:"死亡",value:trace.deaths,tone:trace.deaths>trace.births?"warn":undefined},{label:"下一代种群",value:trace.nextPopulation,hint:`承载量 K=${carryingCapacity}`}]}/><p className="decision-note">C/D 标签显示双方最后一轮行动；适应度使用整次相遇的平均收益，而不是只看最后一轮。</p></>},
      {id:"history",label:"历史回放",content:<HistoryScrubber value={replayIndex} max={history.length-1} onChange={setReplayIndex} label={`第 ${replay.generation} 代`}><CalcGrid items={[{label:"种群数量",value:replay.population},{label:"合作率",value:`${replay.cooperation.toFixed(1)}%`},{label:"平均收益",value:replay.payoff.toFixed(2)},{label:"出生 / 死亡",value:`${replay.births} / ${replay.deaths}`}]}/></HistoryScrubber>},
      {id:"parameters",label:"参数解释",content:<ParamList items={[{symbol:"K",name:"环境承载量",effect:"抑制接近上限时的增长，但不是每代必须达到的固定种群规模。"},{symbol:"β",name:"选择压力",effect:"放大收益差异；越高时优势策略扩张越快，随机漂变影响相对更小。"},{symbol:"μ",name:"基因突变率",effect:"逐位改变合作概率；过高会持续破坏已形成的策略结构。"},{symbol:"ε",name:"行动噪声",effect:"以给定概率翻转合作或背叛，可能引发误判和连续报复。"},{symbol:"T",name:"背叛诱惑",effect:"对方合作时背叛获得的收益；越高，短期背叛优势越强。"},{symbol:"R",name:"相遇轮数",effect:"重复次数越多，互惠、惩罚和宽恕才有机会影响长期收益。"}]}/>} ]}/>
    <section className="method" id="references"><div className="method-inner"><div><p className="eyebrow">Methods & provenance</p><h2>经典框架，<br/>透明扩展。</h2><p>网页借鉴 Axelrod-Python 的重复囚徒困境、策略竞赛与演化过程思想；没有直接复制其计算代码。为了让“种群大小”可变化，我们加入显式出生-死亡和环境承载量，而不是把固定种群的 Moran 过程伪装成数量增长。</p></div><div className="method-grid">
      <div className="method-card"><b>策略基因</b><p>采用 memory-one 概率向量 p=(p₀,pCC,pCD,pDC,pDD)。交叉逐位继承双亲概率，突变加入小幅随机扰动。</p></div><div className="method-card"><b>自然选择</b><p>重复博弈的每轮平均收益映射为繁殖权重。选择压力越高，收益差异对后代数量的放大越强。</p></div><div className="method-card"><b>生态数量</b><p>出生率同时受平均收益和承载量 K 约束，死亡率包含基础死亡与超载惩罚。因此高合作可能支撑更大种群，但不保证任何策略必胜。</p></div><div className="method-card refs"><b>研究与成熟项目</b><p><a href="https://axelrod.readthedocs.io/" target="_blank" rel="noreferrer">Axelrod-Python 文档</a> · <a href="https://github.com/Axelrod-Python/Axelrod" target="_blank" rel="noreferrer">开源项目</a><br/><a href="https://doi.org/10.1126/science.7466396" target="_blank" rel="noreferrer">Axelrod & Hamilton, 1981</a><br/><a href="https://doi.org/10.1038/359826a0" target="_blank" rel="noreferrer">Nowak & May, 1992</a></p></div>
    </div></div></section>
    {showSummary&&summary&&<div className="summary-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setShowSummary(false)}}>
      <section className="summary-sheet" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <div className="summary-sheet-head"><div><p className="eyebrow">Run analysis · 第 0-{generation} 代</p><span>基于本轮完整历史数据生成</span></div><button className="summary-close" onClick={()=>setShowSummary(false)} aria-label="关闭总结">×</button></div>
        <div className="summary-hero"><div className="summary-index">结论<br/><b>01</b></div><div><h2 id="summary-title">{summary.title}</h2><p>本轮合作率{summary.coopState}，种群规模{summary.popState}。这是一项随机演化实验，下面的解释指出与结果一致的机制，而不是把相关性冒充因果。</p></div></div>
        <div className="summary-kpis">
          <div><span>种群净变化</span><b>{summary.popDelta>=0?"+":""}{summary.popDelta}</b><small>{summary.popPct>=0?"+":""}{summary.popPct.toFixed(1)}%</small></div>
          <div><span>平均合作率</span><b>{summary.avgCoop.toFixed(1)}%</b><small>{summary.coopState}</small></div>
          <div><span>平均收益</span><b>{summary.avgPayoff.toFixed(2)}</b><small>每人每轮</small></div>
          <div><span>合作波动</span><b>{summary.volatility.toFixed(1)}</b><small>标准差</small></div>
        </div>
        <div className="summary-body">
          <div className="summary-section"><div className="summary-label">策略权力转移</div><div className="strategy-shift"><div><i style={{background:COLORS[summary.initialDominant.name]}}/><span>第 0 代</span><b>{summary.initialDominant.name}</b><small>{summary.initialDominant.share.toFixed(1)}%</small></div><div className="shift-arrow">→</div><div><i style={{background:COLORS[summary.currentDominant.name]}}/><span>第 {generation} 代</span><b>{summary.currentDominant.name}</b><small>{summary.currentDominant.share.toFixed(1)}%</small></div></div></div>
          <div className="summary-section"><div className="summary-label">关键转折点</div><div className="milestones"><div><span>种群峰值</span><b>{summary.peakPop.population}</b><small>第 {summary.peakPop.generation} 代</small></div><div><span>种群低点</span><b>{summary.lowPop.population}</b><small>第 {summary.lowPop.generation} 代</small></div><div><span>合作最高</span><b>{summary.highCoop.cooperation.toFixed(1)}%</b><small>第 {summary.highCoop.generation} 代</small></div><div><span>合作最低</span><b>{summary.lowCoop.cooperation.toFixed(1)}%</b><small>第 {summary.lowCoop.generation} 代</small></div></div></div>
          <div className="summary-section summary-explanation"><div className="summary-label">可能机制</div><ol>{summary.findings.map((x,i)=><li key={i}>{x}</li>)}</ol></div>
        </div>
        <div className="parameter-strip"><span>β {selection.toFixed(1)}</span><span>μ {(mutation*100).toFixed(1)}%</span><span>ε {(noise*100).toFixed(1)}%</span><span>T {temptation.toFixed(1)}</span><span>{rounds} 轮/相遇</span><span>K {carryingCapacity}</span></div>
        <div className="summary-actions"><p>总结区间从上次重置开始；修改参数但不重置，会被视为同一轮实验。</p><button onClick={async()=>{await navigator.clipboard.writeText(summary.reportText);setCopied(true)}}>{copied?"已复制":"复制实验摘要"}</button></div>
      </section>
    </div>}
  </main></Localized>;
}

function Control({label,value,min,max,step,onChange,suffix="",digits=0,display,reverse=false}:{label:string;value:number;min:number;max:number;step:number;onChange:(n:number)=>void;suffix?:string;digits?:number;display?:string;reverse?:boolean}){
  return <Localized><div className="control-group"><div className="control-row"><label>{label}</label><span className="control-value">{display??`${value.toFixed(digits)}${suffix}`}</span></div><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)} style={reverse?{direction:"rtl"}:undefined}/><div className="range-labels"><span>{min}</span><span>{max}</span></div></div></Localized>;
}
function Metric({label,value,delta}:{label:string;value:string|number;delta?:number}){
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}{delta!==undefined&&delta!==0&&<span className="metric-delta" style={{color:delta<0?"#bd5b4c":undefined}}>{delta>0?"↑":"↓"}{Math.abs(delta).toFixed(label==="合作率"?1:0)}</span>}</div></div>;
}
