"use client";
import {useLanguage} from "./language-provider";
export default function Loading(){const{language}=useLanguage();return <div className="experiment-loading route-loading" role="status"><div className="loading-diagram" aria-hidden="true"><i/><i/><i/><i/></div><b>{language==="zh"?"实验加载中":"Loading experiment"}</b><span>{language==="zh"?"正在准备交互模型与初始状态":"Preparing the interactive model and its initial state"}</span></div>}
