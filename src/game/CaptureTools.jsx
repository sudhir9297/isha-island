import { useEffect, useRef, useState } from "react";

// Debug recording of the actual rendered canvas, without screen permissions.
export default function CaptureTools({ focus = "scene", onFocus, onRehearse, onRehearseDiscovery, onRehearseCrab, onRehearseShell, onEndRehearsal }) {
  const [recording, setRecording] = useState(false), [clip, setClip] = useState(null), [error, setError] = useState("");
  const capture = useRef(null), clipUrl = useRef(null), clipBlob = useRef(null);
  const [saved, setSaved] = useState("");
  const [duration, setDuration] = useState(12);
  useEffect(() => () => {
    const active = capture.current;
    if (active) {
      clearTimeout(active.timer);
      active.recorder.onstop = null;
      if (active.recorder.state === "recording") active.recorder.stop();
      active.stream.getTracks().forEach(track => track.stop());
    }
    if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
  }, []);

  function start() {
    const canvas = document.querySelector("main.app canvas");
    if (!canvas?.captureStream || !window.MediaRecorder) {
      setError("Canvas recording is unavailable in this browser."); return;
    }
    setError(""); setClip(null); setSaved(""); clipBlob.current = null;
    if (clipUrl.current) { URL.revokeObjectURL(clipUrl.current); clipUrl.current = null; }
    const stream = canvas.captureStream(60), chunks = [];
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
    try {
      const recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 10000000 });
      const active = { recorder, stream, timer: null }; capture.current = active;
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        clearTimeout(active.timer); stream.getTracks().forEach(track => track.stop());
        capture.current = null; setRecording(false);
        clipBlob.current = new Blob(chunks, { type: recorder.mimeType });
        clipUrl.current = URL.createObjectURL(clipBlob.current);
        setClip(clipUrl.current);
      };
      recorder.onerror = () => { setError("Recording failed. Try again."); if (recorder.state === "recording") recorder.stop(); };
      recorder.start(250); setRecording(true);
      active.timer = setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, duration * 1000);
    } catch (failure) {
      stream.getTracks().forEach(track => track.stop());
      setError(failure.message || "Recording failed.");
    }
  }

  async function save() {
    try {
      const response = await fetch('/__capture', { method: 'POST', body: clipBlob.current,
        headers: { 'Content-Type': clipBlob.current.type } });
      if (!response.ok) throw new Error('Could not save capture');
      const result = await response.json(); setSaved(result.filename);
    } catch (failure) { setError(failure.message); }
  }

  function downloadPerformance() {
    const root=document.querySelector('main.app');
    const fields=['fps','mainDrawCalls','underwaterDrawCalls','drawCalls','mainTriangles','underwaterTriangles','triangles','geometries','textures','shaderPrograms','gpuTiming','gpuFrameMs','cpuRenderMs','gpuSamples','cameraMode','boatType','renderQuality'];
    const report={capturedAt:new Date().toISOString(),view:focus,viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
      frameTiming:root?.dataset.frameTiming?JSON.parse(root.dataset.frameTiming):null,
      metrics:Object.fromEntries(fields.map(key=>[key,root?.dataset[key]??null])),
      notes:'Rolling window of up to 600 frames. Counts cover main and underwater passes; shadow work is not separately counted. Compare identical camera, quality and viewport after warm-up.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`port-performance-${focus}.json`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  return <aside className="capture-tools" aria-label="Scene capture">
    <label>Capture view <select aria-label="Capture view" value={focus} disabled={recording} onChange={event => onFocus?.(event.target.value)}>
      <option value="scene">Scene</option>
      <option value="gate">Malai Vasal</option>
      <option value="gate-detail">Gate details</option>
      <option value="boat">Boat details</option>
      <option value="traveler">Traveler portrait</option>
      <option value="traveler-side">Traveler side</option>
      <option value="traveler-back">Traveler back</option>
      <option value="manta">Manta ray</option>
      <option value="shark">Reef shark</option>
      <option value="neem">Neem Point</option>
      <option value="adiyogi">Adiyogi Island</option>
      <option value="foliage">Trees and wind</option>
    </select></label>
    <select aria-label="Clip duration" value={duration} disabled={recording} onChange={event => setDuration(Number(event.target.value))}>
      <option value={12}>12 seconds</option>
      <option value={20}>20 seconds</option>
    </select>
    <button onClick={()=>{ window.dispatchEvent(new Event("port:reset-performance")); const root=document.querySelector("main.app"); if(root)delete root.dataset.frameTiming; }}>Reset performance sample</button>
    <button onClick={onRehearseDiscovery}>Rehearse dock discovery</button>
    <button onClick={onRehearseCrab}>Rehearse crab encounter</button>
    <button onClick={onRehearseShell}>Rehearse shell discovery</button>
    <button onClick={() => onRehearseDiscovery('neem-seat')}>Rehearse neem seat</button>
    <button onClick={() => onRehearseDiscovery('bell')}>Rehearse bell</button>
    <button onClick={() => onRehearseDiscovery('stones')}>Rehearse stone skipping</button>
    <button onClick={()=>onRehearse(false)}>Rehearse gate crossing</button>
      <button onClick={()=>onRehearse(true)}>Rehearse quiet overlook</button>
      <button onClick={onEndRehearsal}>End rehearsal</button>
      <button onClick={downloadPerformance}>Download performance snapshot</button>
    <button onClick={start} disabled={recording}>{recording ? `Recording ${duration} seconds…` : "Record scene clip"}</button>
    {recording && <button onClick={() => capture.current?.recorder.stop()}>Stop recording</button>}
    {clip && <a href={clip} download="port-scene.webm">Download scene clip</a>}
    {clip && import.meta.env.DEV && <button onClick={save}>Save local clip</button>}
    {saved && <span role="status">Saved {saved}</span>}
    {error && <span role="status">{error}</span>}
  </aside>;
}
