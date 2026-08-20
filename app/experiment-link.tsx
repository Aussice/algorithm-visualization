"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {ComponentProps,ReactNode,useState} from "react";
import {useLanguage} from "./language-provider";

export default function ExperimentLink({href,className,children,...props}:{href:string;className?:string;children:ReactNode}&Omit<ComponentProps<typeof Link>,"href"|"children">){
  const router=useRouter(),[loading,setLoading]=useState(false),{language}=useLanguage();
  const preload=()=>router.prefetch(href);
  return <><Link {...props} href={href} className={className} prefetch onPointerEnter={preload} onFocus={preload} onTouchStart={preload} onClick={()=>setLoading(true)}>{children}</Link>{loading&&<div className="experiment-loading" role="status" aria-live="polite"><div className="loading-diagram" aria-hidden="true"><i/><i/><i/><i/></div><b>{language==="zh"?"实验加载中":"Loading experiment"}</b><span>{language==="zh"?"正在准备交互模型与初始状态":"Preparing the interactive model and its initial state"}</span></div>}</>;
}
