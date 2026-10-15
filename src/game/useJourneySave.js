import {useEffect} from 'react';
import {JOURNEY_SAVE_KEY, parseJourneySave, restoreJourney, snapshotJourney} from './JourneySave.js';
export default function useJourneySave({boatState, journey, onBoat, ready}) {
  useEffect(()=>{
    try {
      const data=parseJourneySave(localStorage.getItem(JOURNEY_SAVE_KEY));
      if(data){restoreJourney(data,boatState.current,journey.current);onBoat(data.boat.id);}
    }catch { /* Storage may be unavailable in private sessions. */ }
  },[boatState,journey,onBoat]);
  useEffect(()=>{
    if(!ready)return;
    const save=()=>{if(journey.current.rehearsal)return;try{localStorage.setItem(JOURNEY_SAVE_KEY,JSON.stringify(snapshotJourney(boatState.current,journey.current)));}catch{}};
    const hidden=()=>{if(document.hidden)save();};
    const interval=setInterval(save,2000);
    window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',hidden);
    return()=>{clearInterval(interval);window.removeEventListener('pagehide',save);document.removeEventListener('visibilitychange',hidden);};
  },[boatState,journey,ready]);
}
