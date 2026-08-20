"use client";
import Link from "next/link";
import ExperimentLink from "./experiment-link";
import {Localized} from "./language-provider";

const labs = [
  {
    index:"01", href:"/evolutionary-game", tone:"green", label:"Evolutionary dynamics",
    title:"合作如何从背叛中演化？",
    description:"把囚徒困境放进一个会遗传、突变、出生和死亡的种群，观察策略竞争如何改变合作率与种群规模。",
    tags:["重复博弈","遗传算法","逐代解析"],
    stat:"5 类策略实时竞争",
    preview:<svg viewBox="0 0 320 180" aria-hidden="true"><g className="hub-orbit">{[0,1,2].map(i=><ellipse key={i} cx="160" cy="92" rx={48+i*28} ry={27+i*15}/>)}</g>{Array.from({length:34},(_,i)=>{const a=i*2.4,r=18+i*2.3;return <circle key={i} cx={160+Math.cos(a)*r} cy={92+Math.sin(a)*r*.55} r={i%5===0?5:3.4} className={["p-green","p-red","p-gold","p-blue"][i%4]}/>})}</svg>
  },
  {
    index:"02", href:"/multi-robot", tone:"blue", label:"Multi-agent coordination",
    title:"机器人怎样不堵车地搬完货？",
    description:"在动态仓库中分配取货任务、规划最短路径并避免冲突，观察局部决策如何影响整个系统的吞吐量。",
    tags:["任务分配","路径规划","逐步决策"],
    stat:"8 台机器人协同调度",
    preview:<svg viewBox="0 0 320 180" aria-hidden="true"><g className="hub-grid">{Array.from({length:7},(_,i)=><line key={"v"+i} x1={35+i*42} x2={35+i*42} y1="20" y2="160"/>)}{Array.from({length:4},(_,i)=><line key={"h"+i} x1="35" x2="287" y1={28+i*42} y2={28+i*42}/>)}</g><path className="robot-route r1" d="M56 133 L98 133 L98 91 L182 91 L182 49 L266 49"/><path className="robot-route r2" d="M56 49 L140 49 L140 133 L224 133"/><g className="robot-preview"><rect x="47" y="124" width="18" height="18" rx="5"/><rect x="47" y="40" width="18" height="18" rx="5"/><rect x="215" y="124" width="18" height="18" rx="5"/></g><g className="cargo-preview"><rect x="174" y="41" width="16" height="16"/><rect x="258" y="41" width="16" height="16"/></g></svg>
  },
  {
    index:"03", href:"/tsp", tone:"gold", label:"Combinatorial optimization",
    title:"一条路线如何逼近全局最优？",
    description:"让不同搜索策略在同一组城市上竞争，逐步观察交叉、变异和局部改进怎样缩短旅行商回路。",
    tags:["旅行商问题","三种算法","候选解解析"],
    stat:"3 种搜索策略对比",
    preview:<svg viewBox="0 0 320 180" aria-hidden="true"><path className="tsp-route" d="M42 124 L79 43 L151 72 L238 35 L282 96 L220 148 L131 141 L42 124"/>{[[42,124],[79,43],[151,72],[238,35],[282,96],[220,148],[131,141]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="7"/><text x={x} y={y+3}>{i+1}</text></g>)}</svg>
  },
  {
    index:"04", href:"/neural-network", tone:"purple", label:"Supervised learning",
    title:"神经网络如何学会分类？",
    description:"从随机权重开始，观察前向传播、损失计算和反向传播怎样把模糊的预测区域塑造成决策边界。",
    tags:["神经网络","反向传播","决策边界"],
    stat:"实时训练与边界演化",
    preview:<svg viewBox="0 0 320 180" aria-hidden="true" className="nn-preview"><defs><linearGradient id="nn-bg" x1="0" x2="1"><stop offset="0" stopColor="#dce7ee"/><stop offset=".48" stopColor="#ece9df"/><stop offset="1" stopColor="#ead9d6"/></linearGradient></defs><rect x="28" y="22" width="264" height="136" rx="68" fill="url(#nn-bg)"/><path d="M154 24C119 53 193 78 151 102C126 116 135 141 164 157" className="nn-boundary"/>{Array.from({length:28},(_,i)=>{const left=i<14,x=(left?75:212)+(i*29%58),y=45+(i*37%88);return <circle key={i} cx={x} cy={y} r="5" className={left?"nn-a":"nn-b"}/>})}</svg>
  },
  {
    index:"05", href:"/q-learning", tone:"blue", label:"Reinforcement learning",
    title:"智能体如何试错走出迷宫？",
    description:"让智能体在奖励、陷阱和移动成本之间反复试错，观察一张空白 Q 表怎样逐渐变成稳定策略。",
    tags:["Q-learning","探索与利用","价值更新"],
    stat:"状态价值实时传播",
    preview:<svg viewBox="0 0 320 180" aria-hidden="true" className="q-preview">{Array.from({length:35},(_,i)=><rect key={i} x={38+(i%7)*35} y={20+Math.floor(i/7)*30} width="31" height="26" className={[9,10,17,24].includes(i)?"q-wall-preview":"q-cell-preview"}/>)}<path d="M54 143H89V113H124V83H194V53H264" className="q-route-preview"/><circle cx="54" cy="143" r="8" className="q-agent-preview"/><rect x="251" y="40" width="26" height="26" className="q-goal-preview"/></svg>
  },
  {
    index:"06", href:"/boids", tone:"green", label:"Emergent swarm intelligence",
    title:"简单规则如何形成群体智能？",
    description:"每个个体只遵循分离、对齐和聚合三条局部规则，群体却会自行形成队列、绕障、分裂与重组。",
    tags:["Boids","涌现行为","群体智能"],
    stat:"160 个个体实时涌现",
    preview:<svg viewBox="0 0 320 180" aria-hidden="true" className="boids-preview"><ellipse cx="164" cy="90" rx="118" ry="56"/><circle cx="226" cy="92" r="27"/>{Array.from({length:36},(_,i)=>{const a=i*.54,r=25+i*2.5,x=151+Math.cos(a)*r,y=90+Math.sin(a)*r*.43,rot=Math.sin(a)*22;return <path key={i} d="M6 0L-5 3L-2 0L-5-3Z" transform={`translate(${x} ${y}) rotate(${rot})`} className={i%6===0?"boid-gold":"boid-green"}/>})}</svg>
  }
];

export default function AlgorithmHub(){
  return <Localized><main className="hub-page">
    <header className="hub-nav"><Link href="/" className="hub-logo"><span className="hub-logo-mark"><i/><i/><i/></span><span>ALGORITHM<br/>ATLAS</span></Link><nav><a href="#labs">实验目录</a><a href="#method">实验方法</a><ExperimentLink href="/evolutionary-game">进入实验</ExperimentLink></nav><span className="hub-edition">INTERACTIVE LAB</span></header>
    <section className="hub-hero">
      <div className="hero-counter"><span>6</span><small>个可交互<br/>算法实验</small></div>
      <div><p className="hub-kicker">A visual laboratory for intelligent systems</p><h1>看见算法，<em>看见思考</em></h1></div>
      <div className="hub-hero-side"><AlgorithmSignal/><div className="hub-hero-copy"><p>拆开训练、搜索与协作过程。修改参数，查看每一步状态更新，再比较不同算法如何形成答案。</p><a className="hub-primary-cta" href="#labs"><span><small>选择一个问题</small>进入实验目录</span><b>↓</b></a></div></div>
    </section>
    <section className="hub-manifesto"><span>观察状态</span><i>→</i><span>改变参数</span><i>→</i><span>单步验证</span><i>→</i><span>比较结果</span></section>
    <section className="lab-catalog" id="labs">
      <div className="catalog-head"><p className="hub-kicker">Experiment index</p><h2>算法可视化</h2><p>每个实验都能修改参数、逐步运行并回看关键状态。你看到的不只是答案，还有答案形成的过程。</p></div>
      <div className="lab-list">{labs.map(lab=><ExperimentLink className={`lab-entry ${lab.tone}`} href={lab.href} key={lab.index}>
        <div className="lab-entry-index">{lab.index}</div><div className="lab-entry-copy"><span>{lab.label}</span><h3>{lab.title}</h3><p>{lab.description}</p><div className="lab-tags">{lab.tags.map(t=><i key={t}>{t}</i>)}</div></div><div className="lab-preview">{lab.preview}<div className="lab-stat"><span>实验中可观察</span><b>{lab.stat}</b></div></div><div className="lab-enter"><span>进入实验</span><b>↗</b></div>
      </ExperimentLink>)}</div>
    </section>
    <section className="hub-method" id="method"><div><p className="hub-kicker">Experiment method</p><h2>用实践，<br/>理解算法</h2></div><div className="method-steps">{[["建立基线","先用默认参数运行，观察系统的自然状态。"],["单步观察","查看当前候选、计算结果以及算法为何接受这个决定。"],["控制变量","一次只改变一个条件，分离它对结果的真实影响。"],["回看转折","拖动历史快照，对照关键变化发生前后的系统状态。"]].map((x,i)=><div key={x[0]}><span>{String(i+1).padStart(2,"0")}</span><b>{x[0]}</b><p>{x[1]}</p></div>)}</div></section>
    <footer className="hub-footer"><span>算法可视化实验室</span><p>演化、协作、优化与学习</p><a href="#labs">返回实验目录 ↑</a></footer>
  </main></Localized>;
}

function AlgorithmSignal(){
  return <Localized><figure className="hero-signal"><figcaption><span>算法运行结构</span><small>一次实验中的信息流</small></figcaption><svg viewBox="0 0 480 208" role="img" aria-labelledby="signal-title signal-desc"><title id="signal-title">算法实验的信息流</title><desc id="signal-desc">参数进入算法，改变内部状态，产生可观察结果，并通过反馈进入下一步计算。</desc><defs><marker id="signal-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker></defs><g className="signal-connectors"><path d="M112 104H168"/><path d="M288 104H344"/><path d="M404 140V172H228V148"/></g><g className="signal-node input"><rect x="24" y="72" width="88" height="64"/><text x="68" y="99">参数</text><text x="68" y="119">PARAMETER</text></g><g className="signal-node core"><rect x="168" y="60" width="120" height="88"/><text x="228" y="98">状态更新</text><text x="228" y="119">ALGORITHM</text></g><g className="signal-node output"><rect x="344" y="72" width="112" height="64"/><text x="400" y="99">观察结果</text><text x="400" y="119">OUTCOME</text></g><g className="signal-pulse"><circle cx="140" cy="104" r="4"/><circle cx="316" cy="104" r="4"/><circle cx="228" cy="172" r="4"/></g></svg></figure></Localized>
}
