import {useEffect} from 'react';
import {restoreChapterOne} from './ChapterOne.js';
import {JOURNEY_SAVE_KEY, parseJourneySave, restoreJourney, snapshotJourney} from './JourneySave.js';
export default function useJourneySave({boatState, journey, onBoat, ready}) {
  useEffect(()=>{
    // A normal page load is a new arrival. Resume only when explicitly requested.
    if (new URLSearchParams(window.location.search).get("resume") !== "1") return;
    try {
      const data=parseJourneySave(localStorage.getItem(JOURNEY_SAVE_KEY));
      if(restoreChapterOne(data?.journey.chapter)){restoreJourney(data,boatState.current,journey.current);onBoat(boatState.current.boatId);}
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
