import {PENNANTS} from './BoatCosmetics.js';
import KeepsakeInspector from './KeepsakeInspector.jsx';
import { useState } from 'react';
import { KEEPSAKES } from './Keepsakes.js';
export function KeepsakeArt({ id }) {
  return <svg viewBox="0 0 120 120" fill="none" aria-hidden="true">
    {id === 'shell' ? <><path d="M43 94 17 47Q9 24 30 29Q36 10 50 22Q60 6 70 22Q86 10 92 29Q113 24 104 47L77 94Z" fill="#efa88e" stroke="#ffe2b5" strokeWidth="3"/>{[24,42,60,78,96].map(x=><path key={x} d={`M60 91Q${x} 60 ${x} 32`} stroke="#ffe9ce" strokeWidth="3"/>)}<path d="M43 94Q60 102 77 94" stroke="#ffe2b5" strokeWidth="7"/></> : id === 'leaf' ? <><path d="M28 97Q8 40 98 17Q95 98 28 97Z" fill="#b6ce72" stroke="#e1e7a8" strokeWidth="2"/><path d="M23 105 90 27M41 83 35 58M55 68 80 69M68 53 65 36" stroke="#658649" strokeWidth="3"/></> : <><path d="M18 76Q11 45 43 32Q81 13 101 54Q118 89 72 99Q29 108 18 76Z" fill="#a6c9cf" stroke="#d3e4da" strokeWidth="3"/><path d="M27 70Q49 48 91 57M34 83Q59 64 96 71" stroke="#e7e7cc" strokeWidth="4"/></>}
  </svg>;
}
export default function Collection({ items, pennant, onEquip }) {
  const [selected, setSelected] = useState(null);
  const item = KEEPSAKES.find(entry => entry.id === selected);
  return <div className="keepsakes">
    <p className="panel-intro">{items.length} of {KEEPSAKES.length} keepsakes · One memory from each island.</p>
    <div className="keepsake-shelf" aria-label="Island keepsakes">{KEEPSAKES.map(entry => {
      const owned = items.includes(entry.id);
      return <button key={entry.id} className={owned ? 'is-collected' : ''} aria-pressed={selected === entry.id} aria-label={`${entry.name}, ${entry.island}, ${owned ? 'collected' : 'not found'}`} onClick={() => setSelected(entry.id)}>
        <KeepsakeArt id={entry.id}/><strong>{owned ? entry.name : '?'}</strong><small>{entry.island}</small><span>{owned ? 'Collected' : 'To discover'}</span>
      </button>;
    })}</div>
    {item && items.includes(item.id) && <KeepsakeInspector key={item.id} item={item}/>}
    <div className="keepsake-memory" aria-live="polite">{item ? <><h2>{items.includes(item.id) ? item.name : `A keepsake from ${item.island}`}</h2><p>{items.includes(item.id) ? item.memory : item.hint}</p></> : <p>Choose an object to read its story.</p>}</div>
    <div className="pennant-picker" aria-label="Boat pennant"><p>A discovery, a new color for your boat.</p><button aria-pressed={!pennant} onClick={()=>onEquip(null)}>No pennant</button>{PENNANTS.map(p=><button key={p.id} disabled={!items.includes(p.id)} aria-pressed={pennant===p.id} onClick={()=>onEquip(p.id)} title={items.includes(p.id)?p.name:`Find the ${p.id} to unlock`}><span style={{color:p.color}}>⚑</span>{p.name}{!items.includes(p.id)&&" · locked"}</button>)}</div>
    <p className="map-caption">Your keepsakes stay in this satchel when you begin a new journey. Saved on this device.</p>
  </div>;
}
