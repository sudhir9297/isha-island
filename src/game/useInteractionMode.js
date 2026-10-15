import {useEffect,useState} from 'react';
export default function useInteractionMode(){
  const [touch,setTouch]=useState(()=>window.matchMedia('(pointer: coarse)').matches);
  useEffect(()=>{
    const pointer=e=>setTouch(e.pointerType==='touch');
    const keyboard=()=>setTouch(false);
    window.addEventListener('pointerdown',pointer);window.addEventListener('keydown',keyboard);
    return()=>{window.removeEventListener('pointerdown',pointer);window.removeEventListener('keydown',keyboard);};
  },[]);
  return touch;
}
