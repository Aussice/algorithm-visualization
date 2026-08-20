"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import AlgorithmWorkbench,{CalcGrid,Formula,HistoryScrubber,ParamList,ProcessFlow} from "./algorithm-workbench";
import {Localized} from "./language-provider";

type City={id:number;x:number;y:number};
type Algorithm="genetic"|"twoopt"|"annealing";
type TspSnap={iteration:number;distance:number};
type TspTrace={iteration:number;operation:string;before:number;candidate:number;delta:number;accepted:boolean;detail:string};
const seeded=(seed:number)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
function createCities(n:number,seed:number){const r=seeded(seed);return Array.from({length:n},(_,i)=>({id:i+1,x:55+r()*690,y:48+r()*404}))}
function distance(route:number[],cities:City[]){let total=0;for(let i=0;i<route.length;i++){const a=cities[route[i]],b=cities[route[(i+1)%route.length]];total+=Math.hypot(a.x-b.x,a.y-b.y)}return total}
function shuffle(n:number){const a=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function nearest(cities:City[]){const left=new Set(cities.map((_,i)=>i)),route=[0];left.delete(0);while(left.size){const last=route.at(-1)!;let next=-1,best=Infinity;for(const i of left){const d=Math.hypot(cities[last].x-cities[i].x,cities[last].y-cities[i].y);if(d<best){best=d;next=i}}route.push(next);left.delete(next)}return route}
function crossover(a:number[],b:number[]){const n=a.length,start=Math.floor(Math.random()*n),end=start+Math.floor(Math.random()*(n-start));const child=Array(n).fill(-1);for(let i=start;i<=end;i++)child[i]=a[i];let bi=0;for(let i=0;i<n;i++){if(child[i]!==-1)continue;while(child.includes(b[bi]))bi++;child[i]=b[bi++]}if(Math.random()<.25){const x=Math.floor(Math.random()*n),y=Math.floor(Math.random()*n);[child[x],child[y]]=[child[y],child[x]]}return child}
function initialPopulation(n:number,size=48){return Array.from({length:size},()=>shuffle(n))}
function factorialLabel(n:number){let log=0;for(let i=2;i<=n-1;i++)log+=Math.log10(i);log-=Math.log10(2);return log<6?Math.round(10**log).toLocaleString():`≈ 10^${log.toFixed(1)}`}

function DistanceChart({data}:{data:TspSnap[]}){const d=data.slice(-100),values=d.map(x=>x.distance),min=Math.min(...values),max=Math.max(...values,min+1);const pts=values.map((v,i)=>`${i/Math.max(1,values.length-1)*100},${4+(v-min)/(max-min)*46}`).join(" ");return <svg viewBox="0 0 100 54" preserveAspectRatio="none" className="tsp-chart"><path d="M0 4H100M0 27H100M0 50H100"/><polyline points={pts}/></svg>}

export default function TspLab(){
  const[cityCount,setCityCount]=useState(22),[seed,setSeed]=useState(42),[algorithm,setAlgorithm]=useState<Algorithm>("genetic"),[speed,setSpeed]=useState(80);
  const[cities,setCities]=useState<City[]>(()=>createCities(22,42));
  const[route,setRoute]=useState<number[]>(()=>nearest(createCities(22,42)));
  const[initialRoute,setInitialRoute]=useState<number[]>(()=>nearest(createCities(22,42)));
  const[bestDistance,setBestDistance]=useState(()=>distance(nearest(createCities(22,42)),createCities(22,42)));
  const[baseline,setBaseline]=useState(()=>distance(nearest(createCities(22,42)),createCities(22,42)));
  const[iteration,setIteration]=useState(0),[running,setRunning]=useState(false),[temperature,setTemperature]=useState(100),[history,setHistory]=useState<TspSnap[]>([]);
  const[trace,setTrace]=useState<TspTrace>({iteration:0,operation:"等待首次搜索",before:0,candidate:0,delta:0,accepted:false,detail:"选择算法后点击单步，可逐次查看候选解。"});
  const[replayIndex,setReplayIndex]=useState(0);
  const populationRef=useRef<number[][]>([nearest(createCities(22,42)),...initialPopulation(22,47)]),routeRef=useRef(route),citiesRef=useRef(cities),bestRef=useRef(bestDistance),iterationRef=useRef(0),tempRef=useRef(100);
  useEffect(()=>{routeRef.current=route},[route]);useEffect(()=>{citiesRef.current=cities},[cities]);useEffect(()=>{bestRef.current=bestDistance},[bestDistance]);useEffect(()=>{iterationRef.current=iteration},[iteration]);useEffect(()=>{tempRef.current=temperature},[temperature]);
  const reset=useCallback((newSeed=seed,algo=algorithm,count=cityCount)=>{
    const c=createCities(count,newSeed),baseRoute=nearest(c),base=distance(baseRoute,c);let startRoute=baseRoute;
    if(algo==="annealing")startRoute=shuffle(c.length);
    populationRef.current=algo==="annealing"?[startRoute]:[baseRoute,...initialPopulation(c.length,47)];setCities(c);setInitialRoute(baseRoute);setRoute(startRoute);setBaseline(base);setBestDistance(distance(startRoute,c));setIteration(0);setTemperature(100);setHistory([{iteration:0,distance:distance(startRoute,c)}]);setReplayIndex(0);setTrace({iteration:0,operation:"等待首次搜索",before:distance(startRoute,c),candidate:distance(startRoute,c),delta:0,accepted:false,detail:"选择算法后点击单步，可逐次查看候选解。"});setRunning(false);
  },[cityCount,seed,algorithm]);
  const chooseAlgorithm=(a:Algorithm)=>{setAlgorithm(a);reset(seed,a)};
  const step=useCallback(()=>{
    const c=citiesRef.current,n=c.length;let bestRoute=routeRef.current,best=bestRef.current;const before=bestRef.current;let traceNow:TspTrace={iteration:iterationRef.current+1,operation:"",before,candidate:before,delta:0,accepted:false,detail:""};
    if(algorithm==="genetic"){
      const ranked=populationRef.current.map(r=>({r,d:distance(r,c)})).sort((a,b)=>a.d-b.d);if(ranked[0].d<best){best=ranked[0].d;bestRoute=ranked[0].r}
      const elite=ranked.slice(0,10).map(x=>x.r),next=[...elite];while(next.length<48)next.push(crossover(elite[Math.floor(Math.random()*elite.length)],elite[Math.floor(Math.random()*elite.length)]));populationRef.current=next;
      const mean=ranked.reduce((s,x)=>s+x.d,0)/ranked.length;traceNow={...traceNow,operation:"选择精英并繁殖下一代",candidate:ranked[0].d,delta:ranked[0].d-before,accepted:ranked[0].d<before,detail:`48 条路线按距离排序，保留前 10 条；本代平均距离 ${mean.toFixed(1)}。`};
    }else if(algorithm==="twoopt"){
      const current=routeRef.current,i=1+Math.floor(Math.random()*Math.max(1,n-3)),j=i+1+Math.floor(Math.random()*Math.max(1,n-i-1)),candidate=[...current.slice(0,i),...current.slice(i,j+1).reverse(),...current.slice(j+1)],d=distance(candidate,c);if(d<best){best=d;bestRoute=candidate}traceNow={...traceNow,operation:`反转路径区间 ${i}-${j}`,candidate:d,delta:d-before,accepted:d<before,detail:d<before?"候选路线更短，接受这次 2-opt 交换。":"候选路线没有缩短，保留原路线。"};
    }else{
      const current=populationRef.current[0]??routeRef.current,i=Math.floor(Math.random()*n),j=Math.floor(Math.random()*n),candidate=[...current];[candidate[i],candidate[j]]=[candidate[j],candidate[i]];const currentD=distance(current,c),d=distance(candidate,c),temp=Math.max(.15,tempRef.current*.997),probability=d<currentD?1:Math.exp((currentD-d)/temp),accepted=Math.random()<probability;if(accepted)populationRef.current=[candidate];if(d<best){best=d;bestRoute=candidate}setTemperature(temp);traceNow={...traceNow,operation:`交换城市 ${i+1} 与 ${j+1}`,before:currentD,candidate:d,delta:d-currentD,accepted,detail:`温度 ${temp.toFixed(1)}，接受概率 ${(probability*100).toFixed(1)}%；${accepted?"接受候选":"拒绝候选"}。`};
    }
    const nextI=iterationRef.current+1;setRoute([...bestRoute]);setBestDistance(best);setIteration(nextI);setTrace(traceNow);setHistory(h=>{const next=[...h,{iteration:nextI,distance:best}];setReplayIndex(next.length-1);return next});
  },[algorithm]);
  useEffect(()=>{if(!running)return;const t=window.setInterval(step,speed);return()=>window.clearInterval(t)},[running,speed,step]);
  const improvement=baseline?Math.max(0,(baseline-bestDistance)/baseline*100):0,routePoints=route.map(i=>`${cities[i].x},${cities[i].y}`).join(" "),closedPoints=route.length?`${routePoints} ${cities[route[0]].x},${cities[route[0]].y}`:"";
  const initialPoints=initialRoute.map(i=>`${cities[i].x},${cities[i].y}`).join(" ");
  const algoInfo={genetic:["遗传搜索","一组路线同时竞争；保留精英路线，通过有序交叉和交换突变产生下一代。"],twoopt:["2-opt 局部改进","随机选择两条边并反转中间路段；只有路线缩短时才接受新解。"],annealing:["模拟退火","偶尔接受更差路线以逃离局部最优，随着温度下降逐渐转向稳定收敛。"]}[algorithm];
  const replay=history[Math.min(replayIndex,history.length-1)]??{iteration:0,distance:bestDistance};

  return <Localized><main className="viz-page tsp-page">
    <header className="viz-nav"><Link href="/" className="exit-lab viz-exit"><span className="exit-symbol">←</span><span><b>退出实验</b><small>返回目录</small></span></Link><span>03 / COMBINATORIAL OPTIMIZATION</span><Link href="/neural-network" className="next-lab">下一个实验 →</Link></header>
    <section className="viz-intro tsp-intro"><div><p className="viz-kicker">Traveling salesman laboratory</p><h1>旅行商问题<br/>路线优化</h1></div><p>访问每座城市恰好一次并回到起点。城市数量稍一增加，可能路线就会爆炸式增长；搜索算法只能在巨大空间中不断逼近好答案。</p></section>
    <section className="tsp-workspace">
      <aside className="viz-controls tsp-controls"><div className="viz-panel-title">搜索控制 <small>CONTROL</small></div>
        <div className="viz-run"><button onClick={()=>setRunning(v=>!v)}>{running?"暂停搜索":"开始搜索"}</button><button onClick={step} aria-label="单步搜索">+1</button><button onClick={()=>reset()} aria-label="重置路线">↻</button></div>
        <div className="algorithm-picker"><label>搜索算法</label>{([["genetic","遗传搜索"],["twoopt","2-opt"],["annealing","模拟退火"]] as [Algorithm,string][]).map(([id,name])=><button className={algorithm===id?"active":""} key={id} onClick={()=>chooseAlgorithm(id)}><i/>{name}</button>)}</div>
        <TspControl label="城市数量" value={cityCount} min={8} max={50} step={1} onChange={v=>{setCityCount(v);reset(seed,algorithm,v)}} display={`${cityCount} 座`}/>
        <TspControl label="搜索速度" value={speed} min={20} max={500} step={20} onChange={setSpeed} display={`${(1000/speed).toFixed(1)} 次/秒`} reverse/>
        <button className="new-cities" onClick={()=>{const s=seed+1;setSeed(s);reset(s,algorithm)}}>生成另一组城市 ↻</button>
        <div className="algo-note"><b>{algoInfo[0]}</b><p>{algoInfo[1]}</p></div>
      </aside>
      <section className="tsp-map-panel"><div className="warehouse-head"><span>候选路线空间</span><div><i className={running?"on":""}/>{running?"SEARCHING":"PAUSED"} · ITER {iteration}</div></div>
        <svg viewBox="0 0 800 500" className="tsp-map" aria-label="旅行商路径搜索地图">
          <defs><pattern id="tsp-dots" width="25" height="25" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7"/></pattern></defs><rect width="800" height="500" className="tsp-floor"/><rect width="800" height="500" fill="url(#tsp-dots)" className="tsp-dots"/>
          <polyline points={initialPoints+` ${cities[initialRoute[0]]?.x??0},${cities[initialRoute[0]]?.y??0}`} className="initial-route"/>
          <polyline points={closedPoints} className="best-route"/>
          {cities.map((c,i)=><g key={c.id} transform={`translate(${c.x} ${c.y})`} className={`tsp-city ${route[0]===i?"origin":""}`}><circle r={route[0]===i?10:7}/><text y={route[0]===i?-15:3}>{route[0]===i?"START":c.id}</text></g>)}
        </svg><div className="warehouse-legend tsp-legend"><strong>图例</strong><span><i className="lg-current"/>当前最佳</span><span><i className="lg-initial"/>初始最近邻路线</span><span>所有路线均回到起点</span></div>
      </section>
      <aside className="tsp-stats"><div className="viz-panel-title">搜索状态 <small>LIVE METRICS</small></div>
        <div className="tsp-main-stat"><span>当前最佳路程</span><b>{bestDistance.toFixed(1)}</b><small>距离单位</small></div>
        <div className="tsp-metrics"><div><span>相对基线改进</span><b>{improvement.toFixed(1)}%</b></div><div><span>迭代次数</span><b>{iteration}</b></div><div><span>理论搜索空间</span><b>{factorialLabel(cities.length)}</b></div><div><span>{algorithm==="annealing"?"当前温度":"城市数量"}</span><b>{algorithm==="annealing"?temperature.toFixed(1):cities.length}</b></div></div>
        <div className="tsp-chart-block"><span>最佳距离收敛</span><DistanceChart data={history.length?history:[{iteration:0,distance:bestDistance}]}/><small>越低越好 · 显示最近 100 次</small></div>
        <div className="tsp-insight"><div className="robot-subhead">当前观察</div><p>{iteration<10?"搜索刚开始，路线仍高度依赖初始解。":improvement<1?"当前算法尚未明显超越最近邻基线；可能需要更多迭代或更换搜索策略。":`搜索已比最近邻基线缩短 ${improvement.toFixed(1)}%。继续运行时，改进通常会越来越稀少。`}</p></div>
      </aside>
    </section>
    <AlgorithmWorkbench title="一条更短路线是怎样被找到的" subtitle="每次迭代都公开候选路线、距离变化与接受条件；切换算法时，解释会同步变化。" accent="gold" tabs={[
      {id:"principle",label:"算法原理",content:<div className="workbench-split"><div><h3>{algoInfo[0]}</h3><ProcessFlow steps={algorithm==="genetic"?["生成路线种群","按总距离排序","保留精英路线","有序交叉与交换突变"]:algorithm==="twoopt"?["选取两条路径边","反转中间路段","计算新路线总长","仅在缩短时接受"]:["交换两个城市","计算距离差 Δ","按温度决定接受概率","逐渐降温并保存最好解"]}/></div><div><h3>当前算法的判据</h3>{algorithm==="genetic"?<Formula note="短路线拥有更高的繁殖机会，但交叉和突变仍保留探索。">fitness(r) = 1 / L(r)</Formula>:algorithm==="twoopt"?<Formula note="Δ 小于 0 表示两条新边比原来的两条边更短。">Δ = L(candidate) − L(current)</Formula>:<Formula note="更差路线仍可能被接受；温度越低，这个概率越小。">P(accept) = exp(−Δ / T)</Formula>}<p className="decision-note">{algoInfo[1]}</p></div></div>},
      {id:"step",label:"本步计算",content:<><div className="step-callout"><span>ITER {trace.iteration}</span><b>{trace.operation}</b><p>{trace.detail}</p></div><CalcGrid items={[{label:"计算前距离",value:trace.before.toFixed(1)},{label:"候选距离",value:trace.candidate.toFixed(1)},{label:"距离变化 Δ",value:`${trace.delta>=0?"+":""}${trace.delta.toFixed(1)}`,tone:trace.delta<0?"good":trace.delta>0?"warn":undefined},{label:algorithm==="genetic"?"是否刷新最优":"候选是否接受",value:trace.accepted?(algorithm==="genetic"?"是":"接受"):(algorithm==="genetic"?"否":"拒绝"),hint:algorithm==="annealing"?"由温度与概率决定":algorithm==="genetic"?"精英仍会保留":"由改进条件决定",tone:trace.accepted?"good":undefined}]}/></>},
      {id:"history",label:"历史回放",content:<HistoryScrubber value={replayIndex} max={history.length-1} onChange={setReplayIndex} label={`ITER ${replay.iteration}`}><CalcGrid items={[{label:"当时最佳距离",value:replay.distance.toFixed(1)},{label:"相对初始基线",value:`${baseline?Math.max(0,(baseline-replay.distance)/baseline*100).toFixed(1):0}%`},{label:"距当前最佳",value:`${Math.max(0,replay.distance-bestDistance).toFixed(1)}`},{label:"搜索算法",value:algoInfo[0]}]}/></HistoryScrubber>},
      {id:"parameters",label:"参数解释",content:<ParamList items={[{symbol:"n",name:"城市数量",effect:"决定问题规模。不同回路数量约为 (n−1)!/2，增长极快。"},{symbol:"L",name:"路线总距离",effect:"所有相邻城市边长之和，并包含最后一座城市返回起点的距离。"},{symbol:"T",name:"退火温度",effect:"仅用于模拟退火。温度高时更敢于接受坏解，温度低时趋于稳定。"},{symbol:"μ",name:"突变概率",effect:"遗传搜索内部以 25% 概率交换两个城市，避免种群过早同质化。"}]}/>} ]}/>
    <section className="viz-explain tsp-explain"><div><span>01</span><h2>组合爆炸</h2><p>固定起点并忽略反向等价，一共有约 (n−1)!/2 条不同回路。50座城市的完整穷举在现实中不可行。</p></div><div><span>02</span><h2>探索与利用</h2><p>遗传搜索和模拟退火允许暂时保留不完美答案，以换取跳出局部最优的机会；2-opt则专注稳定改进。</p></div><div><span>03</span><h2>好解不等于最优解</h2><p>曲线停止下降只说明算法暂时找不到更好路线。除非使用精确算法证明下界，否则不能声称已找到全局最优。</p></div></section>
  </main></Localized>
}

function TspControl({label,value,min,max,step,onChange,display,reverse=false}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;display:string;reverse?:boolean}){return <div className="viz-control"><label>{label}<b>{display}</b></label><input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(+e.target.value)} style={reverse?{direction:"rtl"}:undefined}/><small><span>{min}</span><span>{max}</span></small></div>}
