import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { NeutralToneMapping, PCFShadowMap, Vector3 } from "three";
import Island from "./game/Island";
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
import FrameMetrics from "./game/FrameMetrics";
import Icon from "./game/Icon";
import SceneBoundary from "./game/SceneBoundary";
import AtollMap from "./game/AtollMap";
import { resetBoatToWater } from "./game/BoatPhysics.js";
import { START } from "./game/WorldConfig";
import { BOATS, boatProfile } from "./game/BoatProfiles";
import CaptureTools from "./game/CaptureTools";

const StaticIsland = memo(Island);
const StaticReef = memo(Reef);
const StaticWildlife = memo(Wildlife);
const StaticBirds = memo(Seabirds);

export default function App() {
  const [panel, setPanel] = useState(null),
    [freeCamera, setFreeCamera] = useState(false),
    [sound, setSound] = useState(false),
    [quality, setQuality] = useState("high"),
    [boatId, setBoatId] = useState("skiff");
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
  const paused = Boolean(panel);
  const { input, setControl } = useInput(paused || freeCamera);
  const boatState = useRef({
    position: new Vector3(START.x, 0, START.z),
    heading: START.heading,
    speed: 0,
    resetId: 0,
    boatId: "skiff",
  });
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
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement;
    const trap = (event) => {
      if (event.key !== "Tab") return;
      const nodes = [
        ...panelRef.current.querySelectorAll(
          'button,a[href],select,[tabindex="0"]',
        ),
      ];
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
      previous?.focus?.();
    };
  }, [panel]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);
  useEffect(() => {
    const key = (e) => {
      if (
        e.repeat ||
        e.target.closest("input,select,textarea,[contenteditable]")
      )
        return;
      if (e.code === "Escape") {
        setPanel(null);
        setSelected(null);
      }
      if (e.code === "KeyR") resetBoatToWater(boatState.current);
      if (e.code === "KeyM") {
        setPanel((p) => (p === "map" ? null : "map"));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const discover = useCallback((id) => {
    setFound((previous) =>
      previous.includes(id) ? previous : [...previous, id],
    );
    setNotice(PLACES.find((p) => p.id === id));
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5500);
  }, []);
  function reset() {
    boatState.current.safeWater = { ...START };
    resetBoatToWater(boatState.current);
    boatState.current.position.set(START.x, 0, START.z);
    boatState.current.heading = START.heading;
    boatState.current.speed = 0;
    boatState.current.resetId += 1;
    setPanel(null);
    setFreeCamera(false);
  }
  function toggleSound() {
    const enabled = !sound;
    setSound(enabled);
    seaAudio.toggle(enabled).catch(() => setSound(false));
  }
  function chooseBoat(id) {
    const profile = boatProfile(id);
    boatState.current.boatId = profile.id;
    setBoatId(profile.id);
    reset();
    setPanel("settings");
  }
  function touch(key, active, e) {
    e.preventDefault();
    if (active) e.currentTarget.setPointerCapture(e.pointerId);
    setControl(key, active);
  }
  const currentPlace = PLACES.find((p) => p.id === selected);
  return (
    <main
      className="app"
      data-camera-mode={freeCamera ? "map" : "sailing"}
      data-boat-x={telemetry.x.toFixed(3)}
      data-boat-z={telemetry.z.toFixed(3)}
      data-boat-speed={telemetry.speed.toFixed(3)}
      data-boat-heading={telemetry.heading.toFixed(3)}
      data-boat-type={boatId}
    >
      {import.meta.env.DEV && new URLSearchParams(window.location.search).has("capture") && <CaptureTools focus={captureFocus} onFocus={(focus) => { setFreeCamera(false); setCaptureFocus(focus); }} />}
      <SceneBoundary>
        <Canvas
          shadows={{ type: PCFShadowMap }}
          dpr={quality === "high" ? [1, 1.5] : 1}
          gl={{
            antialias: true,
            toneMapping: NeutralToneMapping,
            toneMappingExposure: 1.0,
          }}
          fallback={
            <div className="scene-error">This scene needs WebGL support.</div>
          }
        >
          <color attach="background" args={["#07526f"]} />
          <hemisphereLight args={["#d9ecf3", "#647662", 0.82]} />
          <ambientLight intensity={0.12} />
          <directionalLight
            ref={sunRef}
            position={[22, 28, -22]}
            color="#fff1d6"
            intensity={3.2}
            castShadow
            shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
            shadow-camera-left={-35}
            shadow-camera-right={35}
            shadow-camera-top={35}
            shadow-camera-bottom={-35}
            shadow-camera-near={1}
            shadow-camera-far={80}
            shadow-radius={2.3}
            shadow-intensity={0.7}
            shadow-normalBias={0.04}
            shadow-bias={-0.00025}
          />
          <Ocean
            sunRef={sunRef}
            quality={quality}
            onSail={(point) => {
              if (captureFocus === "scene" && !freeCamera && !paused && !islandCollision(point, 0.7)) {
                boatState.current.destination = point.clone();
              }
            }}
          />
          <StaticReef onTerrainReady={setReefField} />
          <StaticIsland />
          <StaticWildlife boatState={boatState} terrainRef={reefField} wildlifeRef={wildlifeState} />
          <StaticBirds />
          <FrameMetrics />
          <Boat
            boatId={boatId}
            input={input}
            boatState={boatState}
            terrainRef={reefField}
            paused={paused || freeCamera}
            onTelemetry={(data) => {
              const p = boatState.current.position;
              setTelemetry({
                speed: data.speed ?? boatState.current.speed,
                x: p.x,
                z: p.z,
                heading: boatState.current.heading,
              });
              seaAudio.speed(paused || freeCamera ? 0 : (data.speed ?? 0));
            }}
          />
          <CameraRig boatState={boatState} freeCamera={freeCamera} captureFocus={captureFocus} wildlifeRef={wildlifeState} mapAction={mapAction} />
          <Discovery
            boatState={boatState}
            found={found}
            onDiscover={discover}
            paused={paused}
          />
        </Canvas>
      </SceneBoundary>
      <a
        className="brand glass"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          reset();
        }}
        aria-label="Port, return to harbour"
      >
        <span className="brand-mark">
          <Icon name="compass" />
        </span>
        <span>
          <strong>port</strong>
          <small>THE LITTLE ATOLL</small>
        </span>
      </a>
      <nav className="nav glass" aria-label="Game menu">
        <button aria-label="Map" onClick={() => setPanel("map")}>
          <Icon name="map" />
          <span>Map</span>
        </button>
        <button aria-label={`Field notes ${found.length}/4`} onClick={() => setPanel("journal")}>
          <Icon name="book" />
          <span>Field notes</span>
          <span className="count">{found.length}/4</span>
        </button>
        <span className="nav-divider" />
        <button
          className="icon-button"
          aria-label={sound ? "Mute sea sounds" : "Enable sea sounds"}
          aria-pressed={sound}
          onClick={toggleSound}
        >
          <Icon name="sound" />
        </button>
        <button
          className="icon-button"
          aria-label="Settings"
          onClick={() => setPanel("settings")}
        >
          <Icon name="gear" />
        </button>
      </nav>

      {telemetry.beached && !paused && <button className="beach-reset glass"
        onClick={() => resetBoatToWater(boatState.current)}>
        <kbd>R</kbd> · Reset to water <small>Automatic return in {Math.max(1, Math.ceil(5 - telemetry.beachedTime))}s</small>
      </button>}
      <div className="map-camera-tools glass" aria-label="Map camera controls">
        <button aria-pressed={freeCamera} onClick={() => {
          setFreeCamera(!freeCamera); setCaptureFocus("scene");
          setMapAction({ type: "island", id: Date.now() });
        }}>{freeCamera ? "Return to boat" : "Explore map"}</button>
        {freeCamera && <>
          <button aria-label="Zoom in" onClick={() => setMapAction({ type: "in", id: Date.now() })}>+</button>
          <button aria-label="Zoom out" onClick={() => setMapAction({ type: "out", id: Date.now() })}>−</button>
          <button onClick={() => setMapAction({ type: "island", id: Date.now() })}>Center island</button>
          <button onClick={() => setMapAction({ type: "boat", id: Date.now() })}>Find boat</button>
          <small>Drag to pan · Scroll / pinch to zoom · Right-drag to orbit</small>
        </>}
      </div>
      {!freeCamera && <div className="controls glass">
        <button className="water-reset" onClick={() => resetBoatToWater(boatState.current)} aria-label="Reset boat to water">
          <kbd>R</kbd> Reset to water
        </button>
        <i />
        <span>
          <kbd>WASD</kbd> / arrows to sail
        </span>
        <i />
        <span>
          <kbd>Space</kbd> to slow
        </span>
        <i />
        <span>Click the sea to sail</span>
      </div>
      }
      <div className="compass" title="North">
        <span>N</span>
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d="m20 9 4 13-4-2-4 2Z" fill="#e2deb4" />
          <circle
            cx="20"
            cy="20"
            r="17"
            fill="none"
            stroke="#819e94"
            strokeWidth=".6"
          />
        </svg>
      </div>
      <div hidden={freeCamera} className="touch-controls" aria-label="Touch steering controls">
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
          aria-label="Brake"
          onPointerDown={(e) => touch("brake", true, e)}
          onPointerUp={(e) => touch("brake", false, e)}
          onPointerCancel={(e) => touch("brake", false, e)}
          onLostPointerCapture={() => {
            setControl("brake", false);
          }}
        >
          Stop
        </button>
      </div>
      {notice && !panel ? (
        <button
          className="discovery-toast glass"
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
          className="panel-backdrop"
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
            <button
              autoFocus
              className="close-button"
              aria-label="Close menu"
              onClick={() => {
                setPanel(null);
                setSelected(null);
              }}
            >
              <Icon name="close" />
            </button>
            <p className="eyebrow">PORT · THE LITTLE ATOLL</p>
            <h1 id="panel-title">
              {panel === "map"
                ? "A sea worth getting lost in"
                : panel === "journal"
                  ? "Small discoveries"
                  : "Make yourself at home"}
            </h1>
            {panel === "map" ? (
              <>
                <p className="panel-intro">
                  Four places to find. No rush to get there.
                </p>
                <AtollMap
                  boat={{
                    x: telemetry.x,
                    z: telemetry.z,
                    heading: telemetry.heading,
                  }}
                  found={found}
                  onSelect={(id) => {
                    setSelected(id);
                    setPanel("journal");
                  }}
                />
                <p className="map-caption">
                  You are the little white boat. Sail close to a place to
                  discover it.
                </p>
              </>
            ) : null}
            {panel === "journal" ? (
              <>
                <p className="panel-intro">
                  {found.length} of 4 places found. The best route is the one
                  you take slowly.
                </p>
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
                  <label htmlFor="boat-choice">
                    <strong>Your boat</strong>
                    <small>{boatProfile(boatId).description}</small>
                  </label>
                  <select id="boat-choice" value={boatId} onChange={(e) => chooseBoat(e.target.value)}>
                    {BOATS.map((boat) => <option key={boat.id} value={boat.id}>{boat.name}</option>)}
                  </select>
                </div>
                <div className="settings-row">
                  <span>
                    <strong>Sounds of the sea</strong>
                    <small>Soft waves and a quiet outboard</small>
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
                    <small>Choose smooth sailing on smaller devices</small>
                  </label>
                  <select
                    id="quality"
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                  >
                    <option value="high">High</option>
                    <option value="balanced">Balanced</option>
                  </select>
                </div>
                <button className="reset-button" onClick={reset}>
                  <Icon name="home" />
                  Return to harbour
                </button>
              </>
            ) : null}
            <button
              className="resume-button"
              onClick={() => {
                setPanel(null);
                setSelected(null);
              }}
            >
              Back to the water <span>→</span>
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}
