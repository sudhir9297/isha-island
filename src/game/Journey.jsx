import LuggageLandingEffects from './LuggageLandingEffects.jsx';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { boatHullPose } from './BoatHull.js';
import { BOAT_SCALE } from './WorldConfig.js';
import { placeCarriedBag, setBagCarryMode, updateTravelerGrip } from './LuggageCarry.js';
import { Luggage } from './TravelerModels.jsx';
import Traveler from './RiggedTraveler.jsx';
import { createLuggageThrow, sampleLuggageThrow } from './LuggageThrow.js';
import { travelerLegPose, travelerUpperPose, WALK_PHASE_PER_METER, WALK_HIP_HEIGHT } from './TravelerGait.js';
import { crossedFootfall } from './Footsteps.js';
import { stepJourney } from './JourneyState.js';
export default function Journey({ journey, boatState, input, paused, onStatus, onRelease, onFootstep, onImpact }) {
  const motion=useRef(), root=useRef(), body=useRef(), legs=useRef([]), knees=useRef([]), ankles=useRef([]), legPose=useRef({}), upperPose=useRef({}), arms=useRef([]), hands=useRef([]), grip=useRef([]), elbows=useRef([]), harness=useRef(), cloth=useRef(), gait=useRef({blend:0,heading:0}), flights=useRef([]), thrown=useRef({}), bags=useRef([]), pose=useRef({}), timer=useRef(0), releaseOrigin=useRef(null);
  useFrame((_,delta)=>{
    if (!body.current || !cloth.current || !harness.current) return;
    motion.current?.reset();
    const s=journey.current, boat=boatState.current;
    const previousJumpTime=s.jumping?s.jumpTime:null;
    const wasReleased=s.released, previousDistance=s.distance, previousReset=s.resetId;
    stepJourney(s,boat,s.rehearsal && !s.rehearsalManual && !s.released ? {forward:true} : input.current,delta,paused);
    if (!paused && !s.jumping && previousReset === s.resetId && crossedFootfall(previousDistance,s.distance,s.running)) onFootstep?.(!s.released, s.position);
    if (!paused && previousReset === s.resetId && previousJumpTime !== null && previousJumpTime < 1 && s.jumpTime >= 1) onFootstep?.(!s.released,s.position);
    if (!s.released) { releaseOrigin.current=null; flights.current=[]; }
    if (!wasReleased && s.released) { onRelease?.(); releaseOrigin.current=s.position.clone(); flights.current=bags.current.map((bag,i)=>createLuggageThrow(bag.position,s.position,i)); }
    const seated=s.mode==='aboard';
    root.current.scale.setScalar(seated ? BOAT_SCALE : 1);
    if(seated){
      boatHullPose(boat,boat.visualTime??0,pose.current);
      root.current.position.copy(boat.position); root.current.position.y+=BOAT_SCALE*(pose.current.bob+.12);
      root.current.rotation.set(pose.current.pitch,boat.heading,pose.current.roll,'YXZ');
    } else {
      const visual=gait.current;
      if(previousReset!==s.resetId) visual.heading=s.heading;
      if(!paused) visual.heading+=Math.atan2(Math.sin(s.heading-visual.heading),Math.cos(s.heading-visual.heading))*(1-Math.exp(-delta*12));
      root.current.position.copy(s.position); root.current.rotation.set(0,visual.heading,0);
    }
    const moving=!seated && s.distance>previousDistance && previousReset===s.resetId;
    if (!paused) gait.current.blend+=(Number(moving)-gait.current.blend)*(1-Math.exp(-Math.min(delta,.05)*12));
    if (!paused) {
      const speed=Math.hypot(s.velocityX || 0,s.velocityZ || 0);
      const target=Math.min(1,speed/((s.released?2.5:1.65)*1.75));
      gait.current.jumpBlend=(gait.current.jumpBlend || 0)+(target-(gait.current.jumpBlend || 0))*(1-Math.exp(-Math.min(delta,.05)*10));
    }
    const stride=gait.current.blend, phase=s.distance*WALK_PHASE_PER_METER;
    const upper=travelerUpperPose(phase,stride,!s.released,upperPose.current);
    if(!paused){
      legs.current.forEach((leg,i)=>{
        if(!leg)return;
        const pose=travelerLegPose(phase+i*Math.PI,stride,legPose.current);
        leg.position.y=seated?.49:WALK_HIP_HEIGHT;
        leg.rotation.x=seated?1.45:pose.hip;
        if(knees.current[i])knees.current[i].rotation.x=seated?-1.35:pose.knee;
        if(ankles.current[i])ankles.current[i].rotation.x=seated?-.1:pose.ankle;
      });
      arms.current.forEach((arm,i)=>{if(arm){
        arm.rotation.x=seated?.45:upper.arm*(i?-1:1);
        arm.rotation.z=(i?1:-1)*(s.released?.06:.32);
      }});
      elbows.current.forEach((elbow,i)=>{if(elbow)elbow.rotation.x=seated?.65:.12+(1-Math.cos(phase+i*Math.PI))*.035*stride;});
    }
    if(cloth.current?.morphTargetInfluences) cloth.current.morphTargetInfluences[0]=seated?1:0;
    if(cloth.current.morphTargetInfluences?.length>=3){
      cloth.current.morphTargetInfluences[1]=seated?0:(.5+.5*Math.cos(phase))*stride;
      cloth.current.morphTargetInfluences[2]=seated?0:(.5-.5*Math.cos(phase))*stride;
    }
    cloth.current.rotation.z=seated?0:Math.sin(phase)*.012*stride;
    updateTravelerGrip(grip.current,!seated&&!s.released,delta);
    harness.current.visible=!seated&&!s.released;
    body.current.position.y=seated?-.36:-.045+upper.bob;
    body.current.rotation.z=seated?0:upper.sway;
    body.current.rotation.y=seated?0:upper.twist;
    body.current.rotation.x=seated?.08:(s.released?0:.16);
    if (!seated && s.released && s.releaseTime < 2 && !s.jumping && !s.running) {
      // Fade to the walking pose as movement resumes; the clip keeps its original clock.
      const endFade=Math.min(1,(2-s.releaseTime)/.25);
      motion.current?.sample('Relief',s.releaseTime,(1-stride)*endFade);
    }
    if (!seated && motion.current && (s.jumping || s.running)) {
      if (s.jumping) motion.current.sampleJump(s.jumpTime,s.distance,gait.current.jumpBlend || 0,s.running);
      else motion.current.sampleRun(s.distance);
      cloth.current.rotation.z = 0;
      if (!s.released) arms.current.forEach((arm,i) => {
        arm.rotation.z=(i ? 1 : -1)*.32;
        arm.rotation.x*=.3;
      });
    }
    motion.current?.smooth(delta);
    root.current.updateWorldMatrix(true, false);
    bags.current.forEach((bag,i)=>{
      if(!bag)return;
      if(i===3)setBagCarryMode(bag,!s.released&&!seated);
      if(s.released){
        let flight=flights.current[i];
        if(!flight && s.releaseOrigin) {
          flight=flights.current[i]=createLuggageThrow(s.releaseOrigin,s.releaseOrigin,i);
          flights.current[i].sounded=true;
        }
        if(flight){
          if (!flight.sounded && s.releaseTime >= flight.duration) { flight.sounded = true; onImpact?.(flight.end); }
          const p=sampleLuggageThrow(flight,s.releaseTime,thrown.current);
          bag.position.set(p.x,p.y,p.z);
          bag.rotation.set(p.spin*.6,p.spin*(i%2?1:-1),p.spin*.35);
        }
      } else {
        if(seated){
          const positions=[[.53,.56,-.85],[-.5,.63,-.8],[.48,.55,.85],[-.5,.55,.85]];
          bag.position.set(...positions[i]);root.current.localToWorld(bag.position);
          bag.quaternion.copy(root.current.quaternion);
        } else {
          placeCarriedBag(bag,i,body.current,hands.current,root.current);
        }
      }
    });
    timer.current+=delta;
    if(timer.current>.12){timer.current=0;onStatus({noteRead:s.noteRead,shellRevealed:s.shellRevealed,shellFound:s.shellFound,nearDiscovery:s.nearDiscovery,activeDiscovery:s.activeDiscovery,mode:s.mode,canLand:s.canLand,released:s.released,releaseTime:s.releaseTime,completed:s.completed,restTime:s.restTime,nearRest:s.nearRest,nearBoat:s.position.distanceTo(s.landing)<1.7});}
  });
  return <><LuggageLandingEffects journey={journey} flights={flights}/><group ref={root}><Traveler journey={journey} motion={motion} legs={legs} knees={knees} ankles={ankles} arms={arms} hands={hands} grip={grip} elbows={elbows} harness={harness} cloth={cloth} body={body}/></group>
    {['#a86e42','#637b68','#b59253','#795949'].map((color,i)=><group key={color} ref={el=>{bags.current[i]=el;}}><Luggage variant={i}/></group>)} </>;
}
