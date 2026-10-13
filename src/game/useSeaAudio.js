import { useRef, useEffect } from "react";
import { createSurfSamples } from "./seaAudioSynthesis.js";

function createAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const samples = createSurfSamples(context.sampleRate);
  const buffer = context.createBuffer(2, samples[0].length, context.sampleRate);
  samples.forEach((channel, index) => buffer.copyToChannel(channel, index));
  const waves = context.createBufferSource();
  waves.buffer = buffer;
  waves.loop = true;
  const seaHighpass = context.createBiquadFilter();
  seaHighpass.type = "highpass";
  seaHighpass.frequency.value = 75;
  const seaLowpass = context.createBiquadFilter();
  seaLowpass.type = "lowpass";
  seaLowpass.frequency.value = 2100;
  seaLowpass.Q.value = 0.5;
  const seaGain = context.createGain();
  seaGain.gain.value = 0.19;
  waves.connect(seaHighpass).connect(seaLowpass).connect(seaGain).connect(master);

  // The wake shares the water texture, opening gently as the boat gains speed.
  const wakeFilter = context.createBiquadFilter();
  wakeFilter.type = "bandpass";
  wakeFilter.frequency.value = 1700;
  wakeFilter.Q.value = 0.6;
  const wakeGain = context.createGain();
  wakeGain.gain.value = 0;
  waves.connect(wakeFilter).connect(wakeGain).connect(master);

  const motor = context.createOscillator();
  motor.setPeriodicWave(context.createPeriodicWave(
    new Float32Array(9),
    new Float32Array([0, 1, 0.42, 0.24, 0.12, 0.08, 0.05, 0.025, 0.012]),
  ));
  motor.frequency.value = 42;
  const motorFilter = context.createBiquadFilter();
  motorFilter.type = "lowpass";
  motorFilter.frequency.value = 420;
  motorFilter.Q.value = 0.5;
  const motorGain = context.createGain();
  motorGain.gain.value = 0.011;
  motor.connect(motorFilter).connect(motorGain).connect(master);

  // Small pitch and amplitude fluctuations keep the idle from sounding like a tone.
  const flutter = context.createOscillator();
  flutter.frequency.value = 5.8;
  const pitchFlutter = context.createGain();
  pitchFlutter.gain.value = 4;
  const amplitudeFlutter = context.createGain();
  amplitudeFlutter.gain.value = 0.0012;
  flutter.connect(pitchFlutter).connect(motor.detune);
  flutter.connect(amplitudeFlutter).connect(motorGain.gain);
  [waves, motor, flutter].forEach((source) => source.start());
  return { context, master, motor, motorFilter, motorGain, wakeGain,
    flutter, sources: [waves, motor, flutter], suspendTimer: null, lastSpeed: -1 };
}

function setSpeed(audio, value) {
  const throttle = Math.min(1, Math.abs(value) / 6.2);
  if (Math.abs(throttle - audio.lastSpeed) < 0.004) return;
  audio.lastSpeed = throttle;
  const now = audio.context.currentTime;
  audio.motor.frequency.setTargetAtTime(42 + throttle * 48, now, 0.3);
  audio.motorFilter.frequency.setTargetAtTime(420 + throttle * 420, now, 0.4);
  audio.motorGain.gain.setTargetAtTime(0.011 + throttle * 0.025, now, 0.3);
  audio.wakeGain.gain.setTargetAtTime(throttle * throttle * 0.1, now, 0.65);
  audio.flutter.frequency.setTargetAtTime(5.8 + throttle * 2.3, now, 0.3);
}

export default function useSeaAudio() {
  const audio = useRef(null);
  const enabledRef = useRef(false);
  const speedRef = useRef(0);

  useEffect(() => () => {
    const previous = audio.current;
    audio.current = null;
    enabledRef.current = false;
    if (!previous) return;
    clearTimeout(previous.suspendTimer);
    previous.sources.forEach((source) => {
      source.stop();
      source.disconnect();
    });
    void previous.context.close().catch(() => {});
  }, []);

  async function toggle(enabled) {
    enabledRef.current = enabled;
    if (!enabled) {
      const previous = audio.current;
      if (!previous) return;
      clearTimeout(previous.suspendTimer);
      previous.master.gain.setTargetAtTime(0, previous.context.currentTime, 0.025);
      previous.suspendTimer = setTimeout(() => {
        if (audio.current === previous && !enabledRef.current) {
          void previous.context.suspend().catch(() => {});
        }
      }, 160);
      return;
    }
    // Creation and resume happen only through the sound button's user gesture.
    if (!audio.current || audio.current.context.state === "closed") {
      audio.current = createAudio();
    }
    const current = audio.current;
    clearTimeout(current.suspendTimer);
    setSpeed(current, speedRef.current);
    await current.context.resume();
    if (audio.current === current && enabledRef.current) {
      current.master.gain.setTargetAtTime(1, current.context.currentTime, 0.12);
    }
  }

  function speed(value) {
    speedRef.current = Number.isFinite(value) ? value : 0;
    if (audio.current && audio.current.context.state !== "closed") {
      setSpeed(audio.current, speedRef.current);
    }
  }

  return { toggle, speed };
}
