import {COSMETIC_KEY, availablePennant} from './game/BoatCosmetics.js';
import CollectionArrival from './game/CollectionArrival.jsx';
import { NEEM_SEAT_EXIT } from './game/NeemSeat.js';
import SandTracks from './game/SandTracks.jsx';
import DockFish from './game/DockFish.jsx';
import { walkingSurfaceHeight } from './game/WalkingSurface.js';
import { ACTIVITIES } from './game/IslandActivities.js';
import IslandActivities from './game/IslandActivities.jsx';
import Collection from './game/Collection.jsx';
import IslandKeepsakes from './game/IslandKeepsakes.jsx';
import { COLLECTION_KEY, readCollection, collectItem } from './game/Keepsakes.js';
import { rememberHint } from './game/MessageFlow.js';
import MapOrbitSurface from './game/MapOrbitSurface.jsx';
import { createMapOrbit, turnMapOrbit } from './game/MapOrbit.js';
import MapIslandMarkers from './game/MapIslandMarkers.jsx';
import { MAP_DESTINATIONS } from './game/MapDestinations.js';
import { SANCTUARY_LIGHT, SANCTUARY_WATER } from './game/ArtDirection.js';
import { ChapterOneHUD } from './game/ChapterOne.jsx';
import { createChapterOne } from './game/ChapterOne.js';
import useJourneySave from './game/useJourneySave.js';
import IslandDirections, { IslandDirectionTracking } from './game/IslandDirections.jsx';
import StartupOverlay from './game/StartupOverlay.jsx';
import { createStartupSequence } from './game/StartupSequence.js';
import { WeatherLighting, GrassInteraction, DriftingLeaves } from './game/Atmosphere.jsx';
import { DockPennants } from './game/WindCloth.jsx';
import NeemIsland from './game/NeemIsland.jsx';
import WindSystem from './game/WindSystem.jsx';
import WindLines from './game/WindLines.jsx';
import GameRendering from './game/rendering/GameRendering.jsx';
import { createGameRenderer } from './game/rendering/createGameRenderer.js';
import GameplayPrompt from './game/GameplayPrompt.jsx';
import { selectGameplayPrompt } from './game/GameplayPrompt.js';
import Compass, { CompassBearing } from './game/Compass.jsx';
import DiscoveryObjects from './game/DiscoveryObjects.jsx';
import DiscoveryCard from './game/DiscoveryCard.jsx';
import { DISCOVERIES, DOCK_NOTE } from './game/Discoveries.js';
import { lazy, Suspense, memo, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NeutralToneMapping, PCFShadowMap, Vector3 } from "three";
import AdiyogiIsland from "./game/AdiyogiIsland.jsx";
import Island from "./game/Island";
import BeachCrab from "./game/BeachCrab.jsx";
import useInteractionMode from "./game/useInteractionMode.js";
import InteractionMarker from "./game/InteractionMarker.jsx";
import { gateGround } from "./game/MalaiVasalGeometry.js";
import { JOURNEY_SAVE_KEY, snapshotJourney, restoreJourney } from "./game/JourneySave.js";
import CheckpointReveal from "./game/CheckpointReveal.jsx";
import GatePortal from "./game/GatePortal.jsx";
import QuietOverlook from "./game/QuietOverlook.jsx";
import Journey from "./game/Journey.jsx";
import { updateBoatTelemetry, updateJourneyStatus } from "./game/JourneyTelemetry.js";
import { createJourney } from "./game/JourneyState.js";
import Boat from "./game/Boat";
import Ocean from "./game/Ocean";
import Reef from "./game/Reef";
import Wildlife from "./game/Wildlife";
import CameraRig from "./game/CameraRig";
import Discovery from "./game/Discovery";
import { PLACES } from "./game/Places";
import { islandCollision } from "./game/IslandCollider";
import useInput from "./game/useInput";
import useSeaAudio from "./game/useSeaAudio";
import Seabirds from "./game/Seabirds";
import Icon from "./game/Icon";
import AutoQuality from "./game/AutoQuality.jsx";
import SceneAudio from "./game/SceneAudio.jsx";
import SceneStartup from "./game/SceneStartup.jsx";
import SceneBoundary from "./game/SceneBoundary";
import { resetBoatToWater } from "./game/BoatPhysics.js";
import { START, HARBOUR, OPENING_APPROACH } from "./game/WorldConfig";
import { diagnosticsOptions } from "./game/Diagnostics.js";
const FrameMetrics = lazy(() => import("./game/FrameMetrics.jsx"));
const CaptureTools = lazy(() => import("./game/CaptureTools.jsx"));

const StaticIsland = memo(Island);
const StaticReef = memo(Reef);
const StaticWildlife = memo(Wildlife);
const StaticBirds = memo(Seabirds);

export default function App() {
  const [keepsakes, setKeepsakes] = useState(() => { try { return readCollection(localStorage); } catch { return []; } });
  const [pennant,setPennant]=useState(()=>{try{return availablePennant(localStorage.getItem(COSMETIC_KEY),keepsakes);}catch{return null;}});
  const equipPennant=id=>{const next=availablePennant(id,keepsakes);setPennant(next);try{if(next)localStorage.setItem(COSMETIC_KEY,next);else localStorage.removeItem(COSMETIC_KEY);}catch{/* Device storage may be unavailable. */}};
  const collectionRef = useRef(keepsakes);
  const [collectedNotice,setCollectedNotice]=useState(null);
  const finishCollectionNotice=useCallback(()=>setCollectedNotice(null),[]);
  const touchInteraction = useInteractionMode();
  const { debug, profiling } = diagnosticsOptions(window.location.search);
  const [panel, setPanel] = useState(null),
    [freeCamera, setFreeCamera] = useState(false),
    [sound, setSound] = useState(false),
    [quality, setQuality] = useState("high"),
    [qualityMode, setQualityMode] = useState(() => {
      try { const saved = localStorage.getItem('port.quality'); return ['auto', 'high', 'balanced'].includes(saved) ? saved : 'auto'; } catch { return 'auto'; }
    });
  const [boatId, setBoatId] = useState("rowboat");
  useEffect(() => { try { localStorage.setItem('port.quality', qualityMode); } catch {} }, [qualityMode]);
  const [sceneReady, setSceneReady] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [startupPhase, setStartupPhase] = useState('loading');
  const startup = useRef(createStartupSequence({ resume: new URLSearchParams(window.location.search).get("resume") === "1" }));
  const skipIntro = useCallback(() => { startup.current.skipRequested = true; }, []);
  const startJourney = useCallback(() => { startup.current.startRequested = true; }, []);
  const reportStartup = useCallback(phase => { setStartupPhase(phase); if (phase === 'complete') setSceneReady(true); }, []);
  const [startupError, setStartupError] = useState('');
  useEffect(() => {
    if (assetsReady) return;
    const timeout = setTimeout(() => setStartupError(previous => previous || 'Loading is taking longer than expected. Check your connection and try again.'), 45000);
    return () => clearTimeout(timeout);
  }, [assetsReady]);
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    if (!sceneReady) return;
    const dismiss = () => setShowHint(false);
    const timer = setTimeout(dismiss, 8000);
    const onKey = (event) => { if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [sceneReady]);
  const [mapSelection, setMapSelection] = useState(null);
  const mapMarkers = useRef([]);
  const mapOrbit = useRef(createMapOrbit());
  const mapBackButton = useRef(null);
  useEffect(() => {
    if (panel !== 'map') return;
    const handle = requestAnimationFrame(() => {
      (mapSelection ? mapBackButton.current : mapMarkers.current[0])?.focus();
    });
    return () => cancelAnimationFrame(handle);
  }, [panel, mapSelection]);
  const selectedIsland = MAP_DESTINATIONS.find(d => d.id === mapSelection);
  const [mapAction, setMapAction] = useState({ type: "island", id: 0 });
  const [captureFocus, setCaptureFocus] = useState("scene");
  const [found, setFound] = useState(() => {
      try {
        const saved = JSON.parse(
          localStorage.getItem("port.atoll.notes.v1") || "[]",
        );
        return Array.isArray(saved)
          ? saved.filter((id) => PLACES.some((place) => place.id === id))
          : [];
      } catch {
        return [];
      }
    }),
    [notice, setNotice] = useState(null),
    [selected, setSelected] = useState(null);
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    x: START.x,
    z: START.z,
    heading: START.heading,
  });
  const paused = Boolean(panel) || !sceneReady;
  const { input, setControl } = useInput(paused || freeCamera);
  const boatState = useRef({
    position: new Vector3(START.x, 0, START.z),
    heading: START.heading,
    speed: 0,
    resetId: 0,
    boatId: "rowboat",
    openingVoyage: true,
    destination: new Vector3(OPENING_APPROACH.x, 0, OPENING_APPROACH.z),
  });
  const journey = useRef({ ...createJourney(0), keepsakes, chapter: createChapterOne() });
  const claimHint = useCallback(label => rememberHint(journey.current.seenHints, label), []);
  const rehearsalBackup = useRef(null);
  const [nearbyPlace, setNearbyPlace] = useState(null);
  useJourneySave({boatState, journey, onBoat:setBoatId, ready:sceneReady});
  const [journeyStatus, setJourneyStatus] = useState({chapterStep:'arrive',mode: "aboard", canLand: false, released: false});
  const reportJourneyStatus = useCallback((data) => {
    const s = journey.current;
    if (!s.rehearsal) {
      let next = collectionRef.current;
      for (const id of s.keepsakes ?? []) next = collectItem(next, id);
      if (s.shellFound) next = collectItem(next, 'shell');
      if (next !== collectionRef.current) {
        const newItem=next.find(id=>!collectionRef.current.includes(id));
        if(newItem)setCollectedNotice(newItem);
        collectionRef.current = next; setKeepsakes(next);
        try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(next)); } catch {}
      }
      s.keepsakes = next;
      if (next.includes('shell')) { s.shellFound = true; s.shellRevealed = true; }
    }
    setJourneyStatus(previous => updateJourneyStatus(previous, data));
  }, []);
  useEffect(() => {
    journey.current.keepsakes = collectionRef.current;
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(collectionRef.current)); } catch {}
  }, []);
  const compassElement = useRef();
  const islandDirectionsElement = useRef();
  const showIslandDirections = sceneReady && !paused && !freeCamera && captureFocus === "scene" && journeyStatus.mode === "aboard";
  const sunRef = useRef();
  const reefField = useRef(null);
  const wildlifeState = useRef({});
  const setReefField = useCallback((field) => { reefField.current = field; }, []);
  const seaAudio = useSeaAudio();
  useEffect(() => {
    try {
      localStorage.setItem("port.atoll.notes.v1", JSON.stringify(found));
    } catch {}
  }, [found]);
  const noticeTimer = useRef(null);
  const panelRef = useRef(null);
  const menuTriggerRef = useRef(null);
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement;
    const menuTrigger = menuTriggerRef.current;
    if (!panelRef.current.contains(document.activeElement) || !document.activeElement.getClientRects().length) {
      [...panelRef.current.querySelectorAll('button')].find((node) => node.getClientRects().length && !node.disabled)?.focus();
    }
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const nodes = [
        ...panelRef.current.querySelectorAll(
          'button,a[href],select,[tabindex="0"]',
        ),
      ].filter((node) => node.getClientRects().length && !node.disabled);
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected && !previous.closest('[role="dialog"]') && !previous.hidden) previous.focus?.();
      else menuTrigger?.focus();
    };
  }, [panel]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    const key = (e) => {
      if (
        !sceneReady || e.repeat ||
        e.target.closest("input,select,textarea,[contenteditable]")
      )
        return;
      if (e.code === "Escape") {
        setPanel((current) => current ? null : "menu");
        setSelected(null);
      }
      if (e.code === "KeyR" && !panelRef.current) resetBoatToWater(boatState.current);
      if (e.code === "KeyI") setPanel(p => p === "collection" ? null : "collection");
      if (e.code === "KeyM") {
        setMapSelection(null);
        setFreeCamera(false); setCaptureFocus("scene");
        setPanel((p) => (p === "map" ? null : "map"));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [sceneReady]);
  const discover = useCallback((id) => {
    setFound((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
    setNotice(PLACES.find((p) => p.id === id));
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5500);
  }, []);
  function reset() {
    boatState.current.safeWater = { ...HARBOUR };
    resetBoatToWater(boatState.current);
    boatState.current.position.set(HARBOUR.x, 0, HARBOUR.z);
    boatState.current.heading = HARBOUR.heading;
    boatState.current.speed = 0;
    boatState.current.resetId += 1;
    const {released, completed, releaseOrigin, noteRead, crabInvited, seenHints, shellRevealed, shellFound, chapter} = journey.current;
    Object.assign(journey.current, createJourney(boatState.current.resetId), {
      keepsakes: collectionRef.current, chapter, released, completed, releaseOrigin, noteRead, crabInvited, seenHints, shellRevealed, shellFound, releaseTime: released ? 8 : 0,
    });
    setPanel(null);
    setFreeCamera(false);
  }
  function restartJourney() {
    try { localStorage.removeItem(JOURNEY_SAVE_KEY); } catch {}
    reset();
    Object.assign(boatState.current, { heading: START.heading, openingVoyage: true, navigation: undefined, safeWater: { ...START }, destination: new Vector3(OPENING_APPROACH.x, 0, OPENING_APPROACH.z) });
    boatState.current.position.set(START.x, 0, START.z);
    Object.assign(journey.current,createJourney(boatState.current.resetId), {chapter:createChapterOne(), keepsakes:collectionRef.current});
    boatState.current.boatId="rowboat";setBoatId("rowboat");
    setJourneyStatus({mode:'aboard',canLand:false,released:false,completed:false,releaseTime:0,restTime:0});
    setShowHint(true);
  }
  function rehearseGate(overlook=false) {
    if (!rehearsalBackup.current) rehearsalBackup.current = snapshotJourney(boatState.current, journey.current);
    Object.assign(journey.current, createJourney(boatState.current.resetId), {mode:'walking', rehearsal:true});
    journey.current.position.set(-.65, gateGround(-.65,1), -11);
    journey.current.landing.set(0,gateGround(0,4),-8);
    if (overlook) { journey.current.position.set(0,gateGround(0,-6.2),-18.2); Object.assign(journey.current,{released:true,releaseTime:8,releaseOrigin:{x:0,y:gateGround(0,-.8),z:-12.8}}); }
    setCaptureFocus('scene'); setFreeCamera(false); setPanel(null);
  }
  function rehearseDiscovery(stage) {
    if (!rehearsalBackup.current) rehearsalBackup.current = snapshotJourney(boatState.current, journey.current);
    Object.assign(journey.current, createJourney(boatState.current.resetId), { mode: 'walking', rehearsal: true, rehearsalManual: true });
    journey.current.position.set(DOCK_NOTE.x, .595, DOCK_NOTE.z - .5);
    if (ACTIVITIES[stage]) {
      const p = ACTIVITIES[stage];
      journey.current.position.set(p.x, walkingSurfaceHeight(p.x,p.z) ?? 0, p.z);
    }
    if (stage === 'neem-seat') {
      const p=NEEM_SEAT_EXIT;
      journey.current.position.set(p.x,walkingSurfaceHeight(p.x,p.z),p.z);
    }
    if (stage === 'shell') {
      Object.assign(journey.current, { noteRead: true, crabInvited: true, shellRevealed: true });
      journey.current.position.set(-3.5, gateGround(-3.5,6.3), -5.7);
    }
    if (stage === 'crab') {
      journey.current.noteRead = true;
      journey.current.position.set(.7, gateGround(.7,6), -6);
    }
    journey.current.landing.set(0, gateGround(0,4), -8);
    setCaptureFocus('scene'); setFreeCamera(false); setPanel(null);
  }
  function endRehearsal() {
    if (!rehearsalBackup.current) return;
    restoreJourney(rehearsalBackup.current,boatState.current,journey.current);
    rehearsalBackup.current=null;
  }
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    seaAudio.toggle(enabled).catch(() => setSound(false));
  }
  function touch(key, active, e) {
    e.preventDefault();
    if (active) { e.currentTarget.setPointerCapture(e.pointerId); setShowHint(false); }
    setControl(key, active);
  }
  const currentPlace = PLACES.find((p) => p.id === selected);
  return (
    <main
      className="app"
      data-camera-mode={panel === "map" ? "overview" : freeCamera ? "map" : "sailing"}
      data-boat-x={telemetry.x.toFixed(3)}
      data-boat-z={telemetry.z.toFixed(3)}
      data-boat-speed={telemetry.speed.toFixed(3)}
      data-boat-heading={telemetry.heading.toFixed(3)}
      data-boat-type={boatId}
      data-startup-phase={startupPhase}
      data-render-quality={quality}
      data-quality-mode={qualityMode}
    >
      {debug && sceneReady && <details className="debug-panel glass"><summary>Debug tools</summary><Suspense fallback={<p>Loading tools…</p>}><CaptureTools onRehearseDiscovery={rehearseDiscovery} onRehearseCrab={() => rehearseDiscovery('crab')} onRehearseShell={() => rehearseDiscovery('shell')} onRehearse={rehearseGate} onEndRehearsal={endRehearsal} focus={captureFocus} onFocus={(focus) => { setFreeCamera(false); setCaptureFocus(focus); }} /></Suspense></details>}
      <StartupOverlay phase={startupPhase} error={startupError} onStart={startJourney} onSkip={skipIntro} />
      <SceneBoundary onError={setStartupError}>
        <Canvas
          shadows={{ type: PCFShadowMap }}
          frameloop="never"
          dpr={quality === "high" ? [1, 2] : 1}
          gl={createGameRenderer}
          onCreated={({ gl }) => { gl.toneMapping = NeutralToneMapping; gl.toneMappingExposure = 1; }}
          fallback={
            <span>This scene needs WebGPU or WebGL 2 support.</span>
          }
        >
          <WindSystem paused={paused}>
          <Suspense fallback={null}><SceneStartup onReady={setAssetsReady} onError={setStartupError} /></Suspense>
          <color attach="background" args={[SANCTUARY_WATER.deep]} />
          <hemisphereLight args={[SANCTUARY_LIGHT.sky, SANCTUARY_LIGHT.ground, SANCTUARY_LIGHT.fill]} />
          <ambientLight intensity={0.22} />
          <directionalLight
            ref={sunRef}
            position={[22, 28, -22]}
            color={SANCTUARY_LIGHT.sun}
            intensity={SANCTUARY_LIGHT.sunIntensity}
            castShadow
            shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
            shadow-camera-left={-35}
            shadow-camera-right={35}
            shadow-camera-top={35}
            shadow-camera-bottom={-35}
            shadow-camera-near={1}
            shadow-camera-far={80}
            shadow-radius={3.5}
            shadow-intensity={SANCTUARY_LIGHT.shadowIntensity}
            shadow-normalBias={0.04}
            shadow-bias={-0.00025}
          />
          <clippingGroup name="Underwater capture" enabled={false}>
          <Ocean
            profiling={profiling}
            sunRef={sunRef}
            quality={quality}
            onSail={(point) => {
              if (captureFocus === "scene" && !freeCamera && !paused && journey.current.mode === "aboard" && !islandCollision(point, 0.7)) {
                setShowHint(false);
                boatState.current.openingVoyage = false;
                boatState.current.destination = point.clone();
              }
            }}
          />
          <StaticReef onTerrainReady={setReefField} />
          <StaticIsland />
          <DockPennants />
          <DockFish journey={journey} boatState={boatState} paused={paused} />
          <DriftingLeaves journey={journey} boatState={boatState} enabled={captureFocus === "scene" && !freeCamera} />
          <DiscoveryObjects journey={journey} paused={paused} onReveal={seaAudio.discovery} />
          <IslandKeepsakes journey={journey} />
          <IslandActivities journey={journey} paused={paused} audio={seaAudio} />
          <SandTracks journey={journey} paused={paused} />
          <BeachCrab journey={journey} boatState={boatState} paused={paused} />
          <AdiyogiIsland />
          <NeemIsland />
          <GatePortal journey={journey} paused={paused} />
          <QuietOverlook journey={journey} />
          <InteractionMarker boatState={boatState} journey={journey} paused={paused || freeCamera} />
          <StaticWildlife boatState={boatState} terrainRef={reefField} wildlifeRef={wildlifeState} />
          <StaticBirds />
          {profiling && <Suspense fallback={null}><FrameMetrics /></Suspense>}
          <Boat pennant={pennant}
            startup={startup}
            boatId={boatId}
            input={input}
            boatState={boatState}
            terrainRef={reefField}
            paused={paused || freeCamera || journeyStatus.mode !== "aboard"}
            onTelemetry={(data) => {
              setBoatId(boatState.current.boatId);
              const p = boatState.current.position;
              setTelemetry(previous => updateBoatTelemetry(previous, {
                ...data,
                speed: data.speed ?? boatState.current.speed,
                x: p.x,
                z: p.z,
                heading: boatState.current.heading,
              }));
              seaAudio.speed(paused || freeCamera || journeyStatus.mode !== "aboard" ? 0 : (data.speed ?? 0), journey.current.mode === "aboard", boatState.current.boatId !== "rowboat");
            }}
          />
          <AutoQuality mode={qualityMode} quality={quality} enabled={sceneReady} paused={paused} onChange={setQuality} />
          <SceneAudio audio={seaAudio} boatState={boatState} journey={journey} paused={paused} />
          <Journey startup={startup} journey={journey} boatState={boatState} input={input} paused={paused || freeCamera} onStatus={reportJourneyStatus} onRelease={seaAudio.release} onFootstep={seaAudio.footstep} onImpact={seaAudio.impact} />
          <CompassBearing element={compassElement} />
          <IslandDirectionTracking element={islandDirectionsElement} boatState={boatState} enabled={showIslandDirections} />
          <CameraRig journey={journey} boatState={boatState} freeCamera={freeCamera} captureFocus={captureFocus} wildlifeRef={wildlifeState} mapAction={mapAction} mapOpen={panel === "map"} mapSelection={mapSelection} mapOrbit={mapOrbit} />
          <MapIslandMarkers markers={mapMarkers} visible={panel === "map" && !mapSelection} />
          <Discovery
            boatState={boatState}
            found={found}
            onDiscover={discover}
            onApproach={setNearbyPlace}
            paused={paused || freeCamera || journeyStatus.mode !== "aboard"}
          />
          <WindLines journey={journey} boatState={boatState} enabled={captureFocus === "scene" && !freeCamera} />
          </clippingGroup>
          <WeatherLighting sunRef={sunRef} />
          <GrassInteraction journey={journey} />
          <GameRendering startup={startup} assetsReady={assetsReady} onStartup={reportStartup} boatState={boatState} journey={journey} quality={quality} onError={setStartupError} />
          </WindSystem>
        </Canvas>
      </SceneBoundary>
      {sceneReady && !panel && !freeCamera && !journeyStatus.activeDiscovery && !journeyStatus.benchSeated && <ChapterOneHUD status={journeyStatus} />}
      <IslandDirections element={islandDirectionsElement} visible={showIslandDirections} />
      <button ref={menuTriggerRef} hidden={Boolean(panel) || !sceneReady} className="menu-trigger" title="Menu · Esc" aria-label="Open menu" aria-haspopup="dialog" onClick={() => { setShowHint(false); setPanel("menu"); }}>
        <span className="menu-lines" aria-hidden="true"><i /><i /><i /></span>
      </button>
      <button hidden={Boolean(panel) || !sceneReady} className="map-trigger" aria-label="Open island map" title="Navigate · M" onClick={() => { setShowHint(false); setMapSelection(null); setFreeCamera(false); setCaptureFocus("scene"); setPanel("map"); }}><Icon name="map" /><span>Map</span></button>
      {collectedNotice && !panel && !journeyStatus.activeDiscovery && !journeyStatus.performingAction && <CollectionArrival key={collectedNotice} id={collectedNotice} onDone={finishCollectionNotice}/>}
      <button hidden={Boolean(panel) || !sceneReady || Boolean(journeyStatus.activeDiscovery)} className="satchel-trigger" aria-label={`Open satchel, ${keepsakes.length} keepsakes`} title="Satchel · I" onClick={() => setPanel('collection')}><Icon name="satchel"/><span>{keepsakes.length} / 3</span></button>
      {sceneReady && !panel && !journeyStatus.activeDiscovery && <Compass element={compassElement} />}
      {journeyStatus.activeDiscovery && !journeyStatus.performingAction && !panel && <DiscoveryCard id={journeyStatus.activeDiscovery} onClose={() => { journey.current.dismissDiscovery = true; }} />}
      {sceneReady && !paused && !journeyStatus.activeDiscovery && <div className="gameplay-prompt-slot" aria-label="Current action">
        {freeCamera ? <div className="map-camera-tools" aria-label="Map camera controls">
          <button onClick={() => { setFreeCamera(false); setCaptureFocus("scene"); }}>Back to journey</button>
          <button aria-label="Zoom in" onClick={() => setMapAction({ type: "in", id: Date.now() })}>+</button>
          <button aria-label="Zoom out" onClick={() => setMapAction({ type: "out", id: Date.now() })}>−</button>
          <button onClick={() => setMapAction({ type: "island", id: Date.now() })}>Recenter</button>
        </div> : <GameplayPrompt
          claimHint={claimHint}
          prompt={selectGameplayPrompt({ journey: journeyStatus, telemetry, paused, freeCamera, showHint, nearbyPlace, touch: touchInteraction })}
          touch={touchInteraction}
          onAction={action => {
            if (action === 'reset') resetBoatToWater(boatState.current);
            else journey.current.requestInteract = true;
            setShowHint(false);
          }} />}
      </div>}
      {sceneReady && !panel && journeyStatus.mode !== "resting" && journeyStatus.released && <CheckpointReveal time={journeyStatus.releaseTime} />}
      {sceneReady && !panel && journeyStatus.mode === 'resting' && <CheckpointReveal time={journeyStatus.restTime} completed />}
      <div hidden={freeCamera || paused || Boolean(journeyStatus.activeDiscovery)} className="touch-controls" aria-label="Touch steering controls">
        {[
          ["forward", "↑"],
          ["left", "←"],
          ["backward", "↓"],
          ["right", "→"],
        ].map(([key, label]) => (
          <button
            key={key}
            className={`touch-${key}`}
            aria-label={key}
            onPointerDown={(e) => touch(key, true, e)}
            onPointerUp={(e) => touch(key, false, e)}
            onPointerCancel={(e) => touch(key, false, e)}
            onLostPointerCapture={() => {
              setControl(key, false);
            }}
          >
            {label}
          </button>
        ))}
        <button
          className="touch-brake"
          aria-label={journeyStatus.mode === "aboard" ? "Brake" : "Jump"}
          onPointerDown={(e) => touch("brake", true, e)}
          onPointerUp={(e) => touch("brake", false, e)}
          onPointerCancel={(e) => touch("brake", false, e)}
          onLostPointerCapture={() => {
            setControl("brake", false);
          }}
        >
          {journeyStatus.mode === "aboard" ? "Stop" : "Jump"}
        </button>
        {journeyStatus.mode !== "aboard" && <button aria-label="Run" onPointerDown={e => touch("run",true,e)} onPointerUp={e => touch("run",false,e)} onPointerCancel={e => touch("run",false,e)} onLostPointerCapture={() => setControl("run",false)}>Run</button>}
      </div>
      {notice && !panel ? (
        <button
          className="discovery-toast"
          onClick={() => {
            setSelected(notice.id);
            setPanel("journal");
          }}
        >
          <span className="toast-icon">
            <Icon name="book" />
          </span>
          <span>
            <small>ADDED TO YOUR FIELD NOTES</small>
            <strong>{notice.name}</strong>
          </span>
          <span>↗</span>
        </button>
      ) : null}
      {panel ? (
        <div
          className={`panel-backdrop ${panel === "map" ? "is-world-map" : panel === "menu" ? "is-explore" : "has-content"}`}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setPanel(null);
              setSelected(null);
            }
          }}
        >
          <section
            ref={panelRef}
            className="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-title"
          >
            {panel === "map" && !mapSelection && <div className="map-island-markers" aria-label="Choose an island">
              {MAP_DESTINATIONS.map((island,i) => <button key={island.id} ref={node => { mapMarkers.current[i] = node; }} className="map-island-hit" onClick={() => setMapSelection(island.id)} aria-label={`Explore ${island.name}`} />)}
            </div>}
            {panel === "map" && <MapOrbitSurface orbit={mapOrbit} />}
            <aside className="menu-sidebar">
              <div className="menu-wordmark" aria-label="Port">port<svg viewBox="0 0 44 12" aria-hidden="true"><path d="M1 7Q11-2 22 7T43 7" /></svg></div>
              <nav className="panel-tabs" aria-label="Explore Port">
                {[["menu", "compass", "Explore"], ["map", "map", "Island map"], ["journal", "book", "Field notes"], ["collection", "satchel", "Satchel"], ["help", "controls", "Controls"], ["settings", "gear", "Settings"]].map(([id, icon, label]) =>
                  <button key={id} aria-label={label} aria-current={panel === id ? "page" : undefined} onClick={() => { if (id === "map") { setMapSelection(null); setFreeCamera(false); setCaptureFocus("scene"); } setPanel(id); setSelected(null); }}><Icon name={icon} /><span>{label}</span></button>
                )}
              </nav>
              <button className="resume-button" onClick={() => { setPanel(null); setSelected(null); }}>Resume</button>
            </aside>
            <button
              autoFocus
              className="close-button"
              aria-label={panel === "map" ? "Return to player" : "Close menu"}
              onClick={() => {
                setPanel(null);
                setSelected(null);
              }}
            >
              <Icon name="close" />
            </button>
            {panel === "map" && <footer className="map-navigation-footer">
              <div className="map-orbit-buttons" aria-label="Rotate map">
                <button aria-label="Rotate map left" onClick={() => turnMapOrbit(mapOrbit.current,.35)}>↶</button>
                <button onClick={() => { mapOrbit.current.targetYaw=0; }} aria-label="Reset view" title="Reset view">⌖</button>
                <button aria-label="Rotate map right" onClick={() => turnMapOrbit(mapOrbit.current,-.35)}>↷</button>
              </div>
              <button className="resume-button" onClick={() => setPanel(null)}>Resume journey <span aria-hidden="true">↗</span></button>
              <p className="map-caption">Drag to explore</p>
            </footer>}
            {panel === "menu" ? <h1 id="panel-title" className="sr-only">Explore Port</h1> : <div className={`panel-content ${panel === "collection" ? "collection-content" : ""}`} key={panel}>
            <button className="mobile-back" onClick={() => { setPanel("menu"); setSelected(null); }}>← Explore</button>
            <h1 id="panel-title">{panel === "help" ? "Controls" : panel === "map" ? selectedIsland?.name ?? "The islands" : panel === "journal" ? "Field notes" : panel === "collection" ? "Your satchel" : "Settings"}</h1>
            {panel === "collection" && <Collection items={keepsakes} pennant={pennant} onEquip={equipPennant} />}
            {panel === "help" && <>
              <p className="panel-intro">Find a quiet shore. Step off the boat and walk through Malai Vasal.</p>
              <dl className="help-list">
                <div><dt>Sail or walk</dt><dd><kbd>WASD</kbd> / arrows</dd></div>
                <div><dt>Sail to a point</dt><dd>Click or tap the sea</dd></div>
                <div><dt>Run on land</dt><dd>Hold <kbd>Shift</kbd> + movement</dd></div>
                <div><dt>Jump on land</dt><dd><kbd>Space</kbd></dd></div>
                <div><dt>Slow the boat</dt><dd><kbd>Space</kbd></dd></div>
                <div><dt>Step ashore / board</dt><dd><kbd>E</kbd> near the shore / boat</dd></div>
                <div><dt>Return boat to water</dt><dd><kbd>R</kbd></dd></div>
                <div><dt>Satchel</dt><dd><kbd>I</kbd></dd></div>
                <div><dt>Map / menu</dt><dd><kbd>M</kbd> / <kbd>Esc</kbd></dd></div>
              </dl>
              <p className="panel-intro">On touch screens, use the arrows to move and Stop to brake aboard; on land, use Jump and hold Run with an arrow. Nearby actions appear on screen.</p>
            </>}
            {panel === "map" && <>
              <p className="panel-intro">{selectedIsland ? selectedIsland.description : "Choose a shore."}</p>
              {selectedIsland && <button ref={mapBackButton} className="map-all-islands" onClick={() => setMapSelection(null)}>← All islands</button>}
            </>}
            {panel === "journal" ? (
              <>
                <p className="panel-intro">
                  {found.length} of {PLACES.length} places found. The best route is the one
                  you take slowly.
                </p>
                {(journeyStatus.noteRead || journeyStatus.shellFound) && <div className="discovery-journal">
                  {['note', 'shell'].filter(id => id === 'note' ? journeyStatus.noteRead : journeyStatus.shellFound).map(id => <article key={id}>
                    <span className="eyebrow">Island discovery</span><h3>{DISCOVERIES[id].title}</h3>
                    <p>{DISCOVERIES[id].text}</p><p>{DISCOVERIES[id].detail}</p>
                  </article>)}
                </div>}
                {currentPlace ? (
                  <article className="place-detail">
                    <span className="eyebrow">
                      {found.includes(currentPlace.id)
                        ? "DISCOVERED"
                        : "STILL TO EXPLORE"}
                    </span>
                    <h2>{currentPlace.name}</h2>
                    <p>{currentPlace.description}</p>
                    <button
                      className="text-button"
                      onClick={() => setSelected(null)}
                    >
                      ← All field notes
                    </button>
                  </article>
                ) : (
                  <div className="places">
                    {PLACES.map((place, i) => (
                      <button
                        key={place.id}
                        onClick={() => setSelected(place.id)}
                      >
                        <span className="place-number">0{i + 1}</span>
                        <span>
                          <strong>{place.name}</strong>
                          <small>{place.subtitle}</small>
                        </span>
                        <span className="place-check">
                          {found.includes(place.id) ? "✓" : "↗"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : null}
            {panel === "settings" ? (
              <>
                <p className="panel-intro">
                  A few little comforts for your time on the water.
                </p>
                <div className="settings-row">
                  <span>
                    <strong>Sounds of the sea</strong>
                    <small>Waves, wind in the trees, and a quiet outboard</small>
                  </span>
                  <button
                    className={`switch ${sound ? "on" : ""}`}
                    onClick={toggleSound}
                    role="switch"
                    aria-checked={sound}
                    aria-label="Sounds of the sea"
                  >
                    <span />
                  </button>
                </div>
                <div className="settings-row">
                  <span>
                    <strong>Free camera</strong>
                    <small>Drag to pan, scroll to zoom</small>
                  </span>
                  <button
                    className={`switch ${freeCamera ? "on" : ""}`}
                    onClick={() => { setFreeCamera((v) => !v); setCaptureFocus("scene"); setMapAction({ type: "island", id: Date.now() }); }}
                    role="switch"
                    aria-checked={freeCamera}
                    aria-label="Free camera"
                  >
                    <span />
                  </button>
                </div>
                <div className="settings-row">
                  <label htmlFor="quality">
                    <strong>Render quality</strong>
                    <small>Auto adapts to performance; manual choices stay fixed</small>
                  </label>
                  <select
                    id="quality"
                    value={qualityMode}
                    onChange={(e) => setQualityMode(e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="high">High</option>
                    <option value="balanced">Balanced</option>
                  </select>
                </div>
                <button className="reset-button" onClick={restartJourney}>Restart journey</button>
                <p className="map-caption">Your chapter progress and unlocked boat are saved on this device.</p>
                <button className="reset-button" onClick={reset}>
                  <Icon name="home" />
                  Return to harbour
                </button>
              </>
            ) : null}
            </div>}
          </section>
        </div>
      ) : null}
    </main>
  );
}
