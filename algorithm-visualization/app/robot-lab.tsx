"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import AlgorithmWorkbench,{CalcGrid,Formula,HistoryScrubber,ParamList,ProcessFlow} from "./algorithm-workbench";
import {Localized} from "./language-provider";

type Cell={x:number;y:number};
type BotState="idle"|"pickup"|"delivery";
type Bot={id:number;x:number;y:number;color:string;state:BotState;taskId?:number;path:Cell[];carrying:boolean;completed:number;distance:number;waits:number;waitStreak:number;yields:number};
type Task={id:number;pickup:Cell;drop:Cell;status:"waiting"|"assigned"|"completed";botId?:number};
type RobotSnap={tick:number;completed:number;waiting:number;busy:number};
type RobotTrace={tick:number;assigned:number;replanned:number;moved:number;blocked:number;yielded:number;focus:string};

const COLS=16,ROWS=10,CELL=50;
const BOT_COLORS=["#3f8068","#577c9a","#d3a14f","#bd5b4c","#88719b","#4f8d8a","#b87352","#60735e"];
const SHELVES=new Set<string>();
for(const x of [4,5,8,9,12,13])for(const y of [1,2,3,6,7,8])SHELVES.add(`${x},${y}`);
const PICKUPS:Cell[]=[{x:3,y:2},{x:6,y:2},{x:7,y:3},{x:10,y:2},{x:11,y:3},{x:14,y:2},{x:3,y:7},{x:6,y:7},{x:7,y:6},{x:10,y:7},{x:11,y:6},{x:14,y:7}];
const DROPS:Cell[]=[{x:0,y:0},{x:0,y:9},{x:15,y:0},{x:15,y:9}];
const key=(c:Cell)=>`${c.x},${c.y}`,same=(a:Cell,b:Cell)=>a.x===b.x&&a.y===b.y;
const manhattan=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

function pathfind(start:Cell,goal:Cell,blocked=new Set<string>()):Cell[]{
  if(same(start,goal))return[];
  const queue:Cell[]=[start],prev=new Map<string,string|null>([[key(start),null]]),byKey=new Map<string,Cell>([[key(start),start]]);
  for(let qi=0;qi<queue.length;qi++){const c=queue[qi];for(const n of [{x:c.x+1,y:c.y},{x:c.x-1,y:c.y},{x:c.x,y:c.y+1},{x:c.x,y:c.y-1}]){const k=key(n);if(n.x<0||n.x>=COLS||n.y<0||n.y>=ROWS||SHELVES.has(k)||(blocked.has(k)&&!same(n,goal))||prev.has(k))continue;prev.set(k,key(c));byKey.set(k,n);queue.push(n);if(same(n,goal)){const path:Cell[]=[];let cursor:string|null=k;while(cursor&&cursor!==key(start)){path.unshift(byKey.get(cursor)!);cursor=prev.get(cursor)??null}return path}}}
  return[];
}
function initialBots(count:number):Bot[]{const starts=[{x:1,y:0},{x:1,y:9},{x:14,y:0},{x:14,y:9},{x:2,y:4},{x:13,y:4},{x:6,y:4},{x:10,y:5}];return Array.from({length:count},(_,i)=>({id:i+1,...starts[i],color:BOT_COLORS[i],state:"idle",path:[],carrying:false,completed:0,distance:0,waits:0,waitStreak:0,yields:0}))}
function initialTasks(count:number):Task[]{return Array.from({length:count},(_,i)=>({id:i+1,pickup:PICKUPS[(i*5+2)%PICKUPS.length],drop:DROPS[(i*3+1)%DROPS.length],status:"waiting"}))}

function MiniLine({data}:{data:RobotSnap[]}){const d=data.slice(-60),max=Math.max(1,...d.map(x=>x.completed));const pts=d.map((x,i)=>`${i/Math.max(1,d.length-1)*100},${52-x.completed/max*46}`).join(" ");return <svg viewBox="0 0 100 54" preserveAspectRatio="none" className="robot-mini-chart"><path d="M0 52H100M0 27H100M0 2H100"/><polyline points={pts}/></svg>}

export default function RobotLab(){
  const[robotCount,setRobotCount]=useState(5),[targetTasks,setTargetTasks]=useState(10),[speed,setSpeed]=useState(360);
  const[running,setRunning]=useState(false),[tick,setTick]=useState(0);
  const[bots,setBots]=useState<Bot[]>(()=>initialBots(5)),[tasks,setTasks]=useState<Task[]>(()=>initialTasks(10));
  const[history,setHistory]=useState<RobotSnap[]>([{tick:0,completed:0,waiting:10,busy:0}]);
  const[trace,setTrace]=useState<RobotTrace>({tick:0,assigned:0,replanned:0,moved:0,blocked:0,yielded:0,focus:"等待首次调度"});
  const[replayIndex,setReplayIndex]=useState(0);
  const[collisionsAvoided,setCollisionsAvoided]=useState(0),[selected,setSelected]=useState<number|null>(null),[nextTaskId,setNextTaskId]=useState(11);
  const botsRef=useRef(bots),tasksRef=useRef(tasks),tickRef=useRef(tick),nextIdRef=useRef(nextTaskId);
  useEffect(()=>{botsRef.current=bots},[bots]);useEffect(()=>{tasksRef.current=tasks},[tasks]);useEffect(()=>{tickRef.current=tick},[tick]);useEffect(()=>{nextIdRef.current=nextTaskId},[nextTaskId]);

  const step=useCallback(()=>{
    const nb=botsRef.current.map(b=>({...b,path:[...b.path]})),nt=tasksRef.current.map(t=>({...t,pickup:{...t.pickup},drop:{...t.drop}}));
    const waiting=()=>nt.filter(t=>t.status==="waiting");let assignedNow=0,replannedNow=0;
    for(const b of nb.filter(x=>x.state==="idle")){
      const pool=waiting();if(!pool.length)break;
      const task=[...pool].sort((a,c)=>manhattan(b,a.pickup)-manhattan(b,c.pickup))[0];task.status="assigned";task.botId=b.id;b.taskId=task.id;b.state="pickup";b.path=pathfind(b,task.pickup);assignedNow++;
    }
    // Robots that wait repeatedly re-plan around the current fleet. This gives
    // head-on traffic a side route instead of repeating the same blocked move.
    for(const b of nb.filter(x=>x.waitStreak>=2&&x.state!=="idle")){
      const task=nt.find(t=>t.id===b.taskId);if(!task)continue;
      const goal=b.state==="pickup"?task.pickup:task.drop;
      const dynamicBlocks=new Set(nb.filter(o=>o.id!==b.id).map(o=>key(o)));
      const detour=pathfind(b,goal,dynamicBlocks);if(detour.length){b.path=detour;replannedNow++}
    }

    const proposed=new Map<number,Cell>();nb.forEach(b=>proposed.set(b.id,b.path[0]??{x:b.x,y:b.y}));
    const currentOwner=new Map(nb.map(b=>[key(b),b.id]));
    const priority=[...nb].sort((a,c)=>c.waitStreak-a.waitStreak||a.id-c.id);
    const rank=new Map(priority.map((b,i)=>[b.id,i]));
    const forcedYield=new Set<number>();

    const taskGoal=(b:Bot)=>{const task=nt.find(t=>t.id===b.taskId);return task?(b.state==="pickup"?task.pickup:task.drop):undefined};
    const chooseYieldCell=(b:Bot)=>{
      const occupied=new Set(nb.filter(o=>o.id!==b.id).map(o=>key(o)));
      const primary=proposed.get(b.id)!;
      const incoming=new Map<string,number>();
      for(const other of nb.filter(o=>o.id!==b.id))for(const p of other.path.slice(0,4))incoming.set(key(p),(incoming.get(key(p))??0)+1);
      const higherIncoming=new Set(priority.filter(o=>(rank.get(o.id)??99)<(rank.get(b.id)??99)).map(o=>key(proposed.get(o.id)!)));
      const goal=taskGoal(b)??primary;
      const candidates=[{x:b.x+1,y:b.y},{x:b.x-1,y:b.y},{x:b.x,y:b.y+1},{x:b.x,y:b.y-1}]
        .filter(n=>n.x>=0&&n.x<COLS&&n.y>=0&&n.y<ROWS&&!SHELVES.has(key(n))&&!occupied.has(key(n))&&!same(n,primary));
      return candidates.sort((a,c)=>{
        const score=(n:Cell)=>(higherIncoming.has(key(n))?1000:0)+(incoming.get(key(n))??0)*12+manhattan(n,goal)*2-
          [{x:n.x+1,y:n.y},{x:n.x-1,y:n.y},{x:n.x,y:n.y+1},{x:n.x,y:n.y-1}].filter(q=>q.x>=0&&q.x<COLS&&q.y>=0&&q.y<ROWS&&!SHELVES.has(key(q))).length;
        return score(a)-score(c);
      })[0];
    };

    // Re-planning can still choose the same congested shortest path. After
    // three consecutive waits, force a one-cell lateral yield-even when it
    // temporarily increases distance-then rebuild the route from there.
    for(const b of priority.filter(x=>x.waitStreak>=3&&x.state!=="idle")){
      const sideStep=chooseYieldCell(b);if(sideStep){proposed.set(b.id,sideStep);forcedYield.add(b.id)}
    }

    // Break head-on swaps immediately by moving the lower-priority robot into
    // a free shoulder cell instead of making both participants wait again.
    for(const b of priority){if(forcedYield.has(b.id))continue;const p=proposed.get(b.id)!,otherId=currentOwner.get(key(p));if(otherId===undefined||otherId===b.id)continue;const other=nb.find(o=>o.id===otherId)!;if(!same(proposed.get(other.id)!,b))continue;const loser=(rank.get(b.id)??0)>(rank.get(other.id)??0)?b:other;if(forcedYield.has(loser.id))continue;const sideStep=chooseYieldCell(loser);if(sideStep){proposed.set(loser.id,sideStep);forcedYield.add(loser.id)}}

    const movers=new Set(nb.filter(b=>!same(proposed.get(b.id)!,b)).map(b=>b.id));

    // One reservation per destination. Waiting time raises priority, preventing
    // a low-numbered robot from permanently starving the rest of the fleet.
    const destinationWinner=new Map<string,number>();
    for(const b of priority){if(!movers.has(b.id))continue;const k=key(proposed.get(b.id)!);if(!destinationWinner.has(k))destinationWinner.set(k,b.id)}
    const active=new Set([...destinationWinner.values()]);

    // A robot may enter a cell that its occupant is leaving. Remove moves whose
    // dependency cannot leave, cascading backward through a blocked convoy.
    let changed=true;
    while(changed){changed=false;for(const id of [...active]){const dest=proposed.get(id)!,owner=currentOwner.get(key(dest));if(owner!==undefined&&owner!==id&&!active.has(owner)){active.delete(id);changed=true}}}

    // Direct position swaps are unsafe. Stop the lower-priority participant;
    // both will then take the dynamic re-planning branch after two waits.
    for(const id of [...active]){const dest=proposed.get(id)!,otherId=currentOwner.get(key(dest));if(otherId===undefined||!active.has(otherId))continue;const otherDest=proposed.get(otherId)!;const self=nb.find(b=>b.id===id)!;if(same(otherDest,self)){const loser=(rank.get(id)??0)>(rank.get(otherId)??0)?id:otherId;active.delete(loser)}}
    changed=true;while(changed){changed=false;for(const id of [...active]){const owner=currentOwner.get(key(proposed.get(id)!));if(owner!==undefined&&owner!==id&&!active.has(owner)){active.delete(id);changed=true}}}

    let avoided=0;
    for(const b of nb){const wantsMove=movers.has(b.id);if(active.has(b.id)){const p=proposed.get(b.id)!;b.x=p.x;b.y=p.y;b.distance++;b.waitStreak=0;if(forcedYield.has(b.id)){b.yields++;const goal=taskGoal(b);if(goal){const dynamicBlocks=new Set(nb.filter(o=>o.id!==b.id).map(o=>key(o)));b.path=pathfind(b,goal,dynamicBlocks);if(!b.path.length&&!same(b,goal))b.path=pathfind(b,goal)}}else b.path.shift()}else if(wantsMove){b.waits++;b.waitStreak++;avoided++}else b.waitStreak=0}
    for(const b of nb){
      const task=nt.find(t=>t.id===b.taskId);if(!task)continue;
      if(b.state==="pickup"&&same(b,task.pickup)){b.state="delivery";b.carrying=true;b.path=pathfind(b,task.drop)}
      else if(b.state==="delivery"&&same(b,task.drop)){task.status="completed";b.state="idle";b.carrying=false;b.taskId=undefined;b.path=[];b.completed++}
    }
    const open=nt.filter(t=>t.status!=="completed").length;let nid=nextIdRef.current;
    if(open<targetTasks&&tickRef.current%3===0){const i=nid;nt.push({id:i,pickup:PICKUPS[(i*7+3)%PICKUPS.length],drop:DROPS[(i*5+2)%DROPS.length],status:"waiting"});nid++}
    const nextTick=tickRef.current+1,completed=nt.filter(t=>t.status==="completed").length;
    const focus=nb.find(b=>b.state!=="idle")??nb[0];
    setBots(nb);setTasks(nt);setTick(nextTick);setNextTaskId(nid);setCollisionsAvoided(v=>v+avoided);setHistory(h=>{const next=[...h,{tick:nextTick,completed,waiting:nt.filter(t=>t.status==="waiting").length,busy:nb.filter(b=>b.state!=="idle").length}];setReplayIndex(next.length-1);return next});
    setTrace({tick:nextTick,assigned:assignedNow,replanned:replannedNow,moved:active.size,blocked:avoided,yielded:forcedYield.size,focus:focus?`R${focus.id}：${focus.state==="pickup"?"前往取货":focus.state==="delivery"?"运往卸货区":"等待任务"}，剩余路径 ${focus.path.length} 格`:"车队为空"});
  },[targetTasks]);
  useEffect(()=>{if(!running)return;const t=window.setInterval(step,speed);return()=>window.clearInterval(t)},[running,speed,step]);
  const reset=(count=robotCount)=>{const b=initialBots(count),t=initialTasks(targetTasks);setRunning(false);setTick(0);setBots(b);setTasks(t);setHistory([{tick:0,completed:0,waiting:t.length,busy:0}]);setReplayIndex(0);setTrace({tick:0,assigned:0,replanned:0,moved:0,blocked:0,yielded:0,focus:"等待首次调度"});setCollisionsAvoided(0);setSelected(null);setNextTaskId(t.length+1)};
  const completed=tasks.filter(t=>t.status==="completed").length,waitingCount=tasks.filter(t=>t.status==="waiting").length,busy=bots.filter(b=>b.state!=="idle").length;
  const selectedBot=bots.find(b=>b.id===selected);
  const totalDistance=bots.reduce((s,b)=>s+b.distance,0),utilization=bots.length?busy/bots.length*100:0;
  const replay=history[Math.min(replayIndex,history.length-1)]??history[0];

  return <Localized><main className="viz-page robot-page">
    <header className="viz-nav"><Link href="/" className="exit-lab viz-exit"><span className="exit-symbol">←</span><span><b>退出实验</b><small>返回目录</small></span></Link><span>02 / MULTI-AGENT COORDINATION</span><Link href="/tsp" className="next-lab">下一个实验 →</Link></header>
    <section className="viz-intro"><div><p className="viz-kicker">Warehouse coordination laboratory</p><h1>多机器人<br/>协作搬运</h1></div><p>中央调度器把等待货物分配给最近的空闲机器人。每台机器人独立规划最短路径，并在每一步通过预约下一格来避免碰撞。</p></section>
    <section className="robot-workspace">
      <aside className="viz-controls">
        <div className="viz-panel-title">调度控制 <small>CONTROL</small></div>
        <div className="viz-run"><button onClick={()=>setRunning(v=>!v)}>{running?"暂停系统":"启动系统"}</button><button onClick={step} aria-label="单步调度">+1</button><button onClick={reset} aria-label="重置仓库">↻</button></div>
        <RobotControl label="机器人数量" value={robotCount} min={2} max={8} step={1} onChange={v=>{setRobotCount(v);reset(v)}} display={`${robotCount} 台`}/>
        <RobotControl label="目标任务积压" value={targetTasks} min={3} max={24} step={1} onChange={setTargetTasks} display={`${targetTasks} 件`}/>
        <RobotControl label="调度速度" value={speed} min={100} max={900} step={50} onChange={setSpeed} display={`${(1000/speed).toFixed(1)} 步/秒`} reverse/>
        <div className="robot-rule"><b>调度规则</b><ol><li>最近空闲机器人优先</li><li>等待时间决定动态路权</li><li>迎面相遇时低优先级者主动侧让</li><li>三步未动即驶入临时避让格</li></ol></div>
      </aside>
      <section className="warehouse-panel">
        <div className="warehouse-head"><span>动态仓库地图</span><div><i className={running?"on":""}/>{running?"RUNNING":"PAUSED"} · T{String(tick).padStart(4,"0")}</div></div>
        <svg viewBox={`0 0 ${COLS*CELL} ${ROWS*CELL}`} className="warehouse-map" aria-label="多机器人仓库地图">
          <defs><pattern id="warehouse-grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse"><path d={`M ${CELL} 0 L 0 0 0 ${CELL}`}/></pattern></defs>
          <rect width="800" height="500" className="warehouse-floor"/><rect width="800" height="500" fill="url(#warehouse-grid)" className="warehouse-grid"/>
          {DROPS.map((d,i)=><g key={i} transform={`translate(${d.x*CELL} ${d.y*CELL})`} className="drop-zone"><rect x="4" y="4" width="42" height="42"/><text x="25" y="30">D{i+1}</text></g>)}
          {[...SHELVES].map(k=>{const[x,y]=k.split(",").map(Number);return <g key={k} transform={`translate(${x*CELL} ${y*CELL})`} className="shelf"><rect x="3" y="3" width="44" height="44" rx="3"/><path d="M10 13H40M10 25H40M10 37H40"/></g>})}
          {tasks.filter(t=>t.status!=="completed").map(t=><g key={t.id} transform={`translate(${t.pickup.x*CELL+25} ${t.pickup.y*CELL+25})`} className={`cargo ${t.status}`}><rect x="-9" y="-9" width="18" height="18" rx="2"/><text y="3">{t.id}</text></g>)}
          {bots.map(b=>b.path.length>0&&<polyline key={"p"+b.id} points={[`${b.x*CELL+25},${b.y*CELL+25}`,...b.path.map(p=>`${p.x*CELL+25},${p.y*CELL+25}`)].join(" ")} stroke={b.color} className="bot-path"/>)}
          {bots.map(b=><g key={b.id} transform={`translate(${b.x*CELL+25} ${b.y*CELL+25})`} className={`warehouse-bot ${selected===b.id?"selected":""}`} onClick={()=>setSelected(b.id)}><circle r="18" fill={b.color}/><rect x="-10" y="-9" width="20" height="18" rx="5"/><circle cx="-5" cy="-1" r="2"/><circle cx="5" cy="-1" r="2"/><text y="30">R{b.id}</text>{b.carrying&&<rect className="bot-load" x="-7" y="-23" width="14" height="12" rx="2"/>}</g>)}
        </svg>
        <div className="warehouse-legend"><strong>图例</strong><span><i className="lg-robot"/>机器人</span><span><i className="lg-cargo"/>待取货物</span><span><i className="lg-drop"/>卸货区</span><span><i className="lg-route"/>当前规划路径</span></div>
      </section>
      <aside className="robot-stats">
        <div className="viz-panel-title">系统状态 <small>LIVE METRICS</small></div>
        <div className="robot-metrics"><div><span>已完成</span><b>{completed}</b><small>件货物</small></div><div><span>系统利用率</span><b>{utilization.toFixed(0)}%</b><small>{busy}/{bots.length} 忙碌</small></div><div><span>等待任务</span><b>{waitingCount}</b><small>尚未分配</small></div><div><span>避免冲突</span><b>{collisionsAvoided}</b><small>次停车</small></div></div>
        <div className="robot-chart-block"><span>累计完成量</span><MiniLine data={history}/></div>
        <div className="fleet-list"><div className="robot-subhead">机器人队列</div>{bots.map(b=><button className={selected===b.id?"active":""} onClick={()=>setSelected(b.id)} key={b.id}><i style={{background:b.color}}/><b>R{b.id}</b><span>{b.state==="idle"?"空闲":b.state==="pickup"?"前往取货":"正在配送"}</span><small>{b.completed} 件</small></button>)}</div>
        <div className="bot-inspector">{selectedBot?<><div className="robot-subhead">R{selectedBot.id} 详情</div><p>状态 <b>{selectedBot.state}</b></p><p>累计路程 <b>{selectedBot.distance} 格</b></p><p>避让等待 <b>{selectedBot.waits} 次</b></p><p>连续等待 <b>{selectedBot.waitStreak} 步</b></p><p>主动让行 <b>{selectedBot.yields} 次</b></p><p>当前任务 <b>{selectedBot.taskId??"-"}</b></p></>:<><div className="robot-subhead">系统提示</div><p>点击地图中的机器人查看个体状态。增加机器人不一定提高效率：狭窄通道会产生更多路径冲突。</p><p>车队累计移动 <b>{totalDistance} 格</b></p></>}</div>
      </aside>
    </section>
    <AlgorithmWorkbench title="调度器如何做出每一步决定" subtitle="把任务分配、最短路搜索和冲突消解拆开观察；数据来自当前仓库的真实调度步。" accent="blue" tabs={[
      {id:"principle",label:"算法原理",content:<div className="workbench-split"><div><h3>中央调度的三层决策</h3><ProcessFlow steps={["空闲机器人领取最近任务","网格搜索生成无障碍路径","预约下一格并解决冲突","连续等待后重新规划与侧让"]}/></div><div><h3>核心代价与优先级</h3><Formula note="当前实现以曼哈顿距离选择最近货物；货架网格路径由无权最短路搜索得到。">Cᵢⱼ = |Rᵢ − Pⱼ|₁</Formula><Formula note="等待越久，路权越高；编号只在等待时间相同时打破平局。">priority = waitStreak ↓, id ↑</Formula></div></div>},
      {id:"step",label:"本步计算",content:<><div className="step-callout"><span>STEP {trace.tick}</span><b>{trace.focus}</b></div><CalcGrid items={[{label:"新分配任务",value:trace.assigned,hint:"最近空闲机器人"},{label:"重新规划",value:trace.replanned,hint:"绕开当前车队"},{label:"成功移动",value:trace.moved,hint:`共 ${bots.length} 台机器人`,tone:"good"},{label:"预约被阻挡",value:trace.blocked,hint:"本步停车数",tone:trace.blocked?"warn":undefined},{label:"主动侧让",value:trace.yielded,hint:"打破局部死锁"}]}/><p className="decision-note">先为每台机器人提出下一格，再按等待时间排序预约目的格；只有目的格唯一、且原占用者也能离开时，移动才会被批准。</p></>},
      {id:"history",label:"历史回放",content:<HistoryScrubber value={replayIndex} max={history.length-1} onChange={setReplayIndex} label={`T${replay.tick}`}><CalcGrid items={[{label:"累计完成",value:replay.completed},{label:"等待任务",value:replay.waiting},{label:"忙碌机器人",value:`${replay.busy}/${bots.length}`},{label:"系统利用率",value:`${bots.length?(replay.busy/bots.length*100).toFixed(0):0}%`} ]}/></HistoryScrubber>},
      {id:"parameters",label:"参数解释",content:<ParamList items={[{symbol:"N",name:"机器人数量",effect:"增加并行能力，也增加窄通道中的预约竞争；更多不一定更快。"},{symbol:"Q",name:"目标任务积压",effect:"调度器维持的开放任务数量。数值越大，机器人越容易持续忙碌。"},{symbol:"Δt",name:"调度速度",effect:"只改变动画和决策步频率，不改变路径规划结果。"},{symbol:"w",name:"连续等待",effect:"提高动态路权；达到阈值后触发绕行和主动侧让。"}]}/>} ]}/>
    <section className="viz-explain"><div><span>01</span><h2>任务分配</h2><p>每当机器人空闲，调度器计算它到全部等待货物的曼哈顿距离，并选择最近目标。这个贪心规则响应快，但不保证全局最优。</p></div><div><span>02</span><h2>动态路权</h2><p>等待时间越长，机器人下一步的预约优先级越高。这样不会由固定编号长期占据主通道，也能减少局部饥饿。</p></div><div><span>03</span><h2>主动让行</h2><p>迎面交换或连续三步无法前进时，低路权机器人会驶入交通较少的相邻格，随后从新位置重新规划，主动打破局部死锁。</p></div></section>
  </main></Localized>
}

function RobotControl({label,value,min,max,step,onChange,display,reverse=false}:{label:string;value:number;min:number;max:number;step:number;onChange:(v:number)=>void;display:string;reverse?:boolean}){return <div className="viz-control"><label>{label}<b>{display}</b></label><input aria-label={label} type="range" value={value} min={min} max={max} step={step} onChange={e=>onChange(+e.target.value)} style={reverse?{direction:"rtl"}:undefined}/><small><span>{min}</span><span>{max}</span></small></div>}
