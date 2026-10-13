import { useEffect, useRef, useState } from "react";

// Development-only recording of the actual rendered canvas, without screen permissions.
export default function CaptureTools({ focus = "scene", onFocus }) {
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

  return <aside style={{position:"fixed",bottom:64,right:18,zIndex:20,padding:12,borderRadius:12,background:"#143e35",color:"#fff",display:"flex",gap:12,alignItems:"center"}} aria-label="Scene capture">
    <label>Capture view <select aria-label="Capture view" value={focus} disabled={recording} onChange={event => onFocus?.(event.target.value)}>
      <option value="scene">Scene</option>
      <option value="gate">Malai Vasal</option>
      <option value="gate-detail">Gate details</option>
      <option value="boat">Boat details</option>
      <option value="manta">Manta ray</option>
      <option value="shark">Reef shark</option>
      <option value="foliage">Trees and wind</option>
    </select></label>
    <select aria-label="Clip duration" value={duration} disabled={recording} onChange={event => setDuration(Number(event.target.value))}>
      <option value={12}>12 seconds</option>
      <option value={20}>20 seconds</option>
    </select>
    <button onClick={start} disabled={recording}>{recording ? `Recording ${duration} seconds…` : "Record scene clip"}</button>
    {recording && <button onClick={() => capture.current?.recorder.stop()}>Stop recording</button>}
    {clip && <a href={clip} download="port-scene.webm">Download scene clip</a>}
    {clip && <button onClick={save}>Save local clip</button>}
    {saved && <span role="status">Saved {saved}</span>}
    {error && <span role="status">{error}</span>}
  </aside>;
}
