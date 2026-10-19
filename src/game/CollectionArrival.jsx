import { useEffect, useState } from 'react';
import { KeepsakeArt } from './Collection.jsx';
import { KEEPSAKES } from './Keepsakes.js';
export default function CollectionArrival({id,onDone}) {
  const [flying,setFlying]=useState(false);
  useEffect(()=>{const start=setTimeout(()=>setFlying(true),250);const end=setTimeout(onDone,1800);return()=>{clearTimeout(start);clearTimeout(end);};},[onDone]);
  const item=KEEPSAKES.find(x=>x.id===id);
  if(!item)return null;
  return <div className={`collection-arrival ${flying?'is-flying':''}`} role="status" aria-label={`${item.name} added to your satchel`}><KeepsakeArt id={id}/><span>Added to your satchel</span></div>;
}
