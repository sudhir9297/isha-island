import {createIslandSoundscape} from './IslandSoundscape.js';
import { createWindAudio } from './WindAudio.js';
import { useRef, useEffect } from "react";
import { footstepSamples } from "./Footsteps.js";
import { ambientMix, positionAudio, spatialPanner } from "./SpatialAudio.js";
import { createSurfSamples } from "./seaAudioSynthesis.js";

function createAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const boatPanner = spatialPanner(context, master, {x: 0, y: 0, z: 0});
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
  waves.connect(wakeFilter).connect(wakeGain).connect(boatPanner);

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
  motor.connect(motorFilter).connect(motorGain).connect(boatPanner);

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
  const wind = createWindAudio(context, master);
  const soundscape = createIslandSoundscape(context, master);
  const footsteps = [false, true].map(burdened => {
    const data = footstepSamples(context.sampleRate, burdened);
    const clip = context.createBuffer(1, data.length, context.sampleRate);
    clip.copyToChannel(data, 0);
    return clip;
  });
  return { context, master, wind, soundscape, boatPanner, seaGain, motor, motorFilter, motorGain, wakeGain, footsteps, amplitudeFlutter,
    flutter, sources: [waves, motor, flutter, wind.source, soundscape.source], suspendTimer: null, lastSpeed: -1 };
}

function setSpeed(audio, value, aboard = true, powered = true) {
  const throttle = Math.min(1, Math.abs(value) / 6.2);
  if (Math.abs(throttle - audio.lastSpeed) < 0.004 && audio.aboard === aboard && audio.powered === powered) return;
  audio.aboard = aboard;
  audio.powered = powered;
  audio.lastSpeed = throttle;
  const now = audio.context.currentTime;
  audio.motor.frequency.setTargetAtTime(42 + throttle * 48, now, 0.3);
  audio.motorFilter.frequency.setTargetAtTime(420 + throttle * 420, now, 0.4);
  audio.motorGain.gain.setTargetAtTime(powered ? (aboard ? 0.011 + throttle * 0.025 : .004) : 0, now, 0.3);
  audio.amplitudeFlutter.gain.setTargetAtTime(powered && aboard ? .0012 : 0, now, .15);
  audio.wakeGain.gain.setTargetAtTime(throttle * throttle * 0.1, now, 0.65);
  audio.flutter.frequency.setTargetAtTime(5.8 + throttle * 2.3, now, 0.3);
}

export default function useSeaAudio() {
  const audio = useRef(null);
  const enabledRef = useRef(false);
  const speedRef = useRef(0);
  const aboardRef = useRef(true);
  const poweredRef = useRef(false);

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
    setSpeed(current, speedRef.current, aboardRef.current, poweredRef.current);
    await current.context.resume();
    if (audio.current === current && enabledRef.current) {
      current.master.gain.setTargetAtTime(1, current.context.currentTime, 0.12);
    }
  }

  function speed(value, aboard = true, powered = true) {
    aboardRef.current = aboard;
    poweredRef.current = powered;
    speedRef.current = Number.isFinite(value) ? value : 0;
    if (audio.current && audio.current.context.state !== "closed") {
      setSpeed(audio.current, speedRef.current, aboard, powered);
    }
  }

  function release() {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== "running") return;
    const now = current.context.currentTime;
    // A soft, short harmonic opening; it follows the existing sound preference.
    [261.63, 392, 523.25].forEach((frequency, i) => {
      const tone = current.context.createOscillator(), gain = current.context.createGain();
      tone.type = "sine"; tone.frequency.value = frequency;
      const start = now + i * .13;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.025 / (i + 1), start + .18);
      gain.gain.exponentialRampToValueAtTime(.0001, start + 2.2);
      tone.connect(gain).connect(current.master);
      current.sources.push(tone);
      tone.onended = () => {
        tone.disconnect(); gain.disconnect();
        const index = current.sources.indexOf(tone);
        if (index >= 0) current.sources.splice(index, 1);
      };
      tone.start(start); tone.stop(start + 2.3);
    });
  }

  function footstep(burdened, position) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== "running") return;
    const source = current.context.createBufferSource(), gain = current.context.createGain();
    source.buffer = current.footsteps[burdened ? 1 : 0];
    gain.gain.value = burdened ? .28 : .19;
    const panner = position ? spatialPanner(current.context, current.master, position) : null;
    source.connect(gain).connect(panner ?? current.master);
    current.sources.push(source);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); panner?.disconnect();
      const index = current.sources.indexOf(source);
      if (index >= 0) current.sources.splice(index, 1);
    };
    source.start();
  }
  function spatial(position, forward, boatPosition, released) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== 'running') return;
    const now = current.context.currentTime, listener = current.context.listener;
    positionAudio(listener, {x: position.x, y: (position.y ?? 0) + 1.4, z: position.z}, now);
    const length = Math.hypot(forward.x, forward.z) || 1;
    listener.forwardX.setTargetAtTime(forward.x / length, now, .08);
    listener.forwardY.setTargetAtTime(0, now, .08);
    listener.forwardZ.setTargetAtTime(forward.z / length, now, .08);
    listener.upX.value = 0; listener.upY.value = 1; listener.upZ.value = 0;
    positionAudio(current.boatPanner, boatPosition, now);
    current.seaGain.gain.setTargetAtTime(ambientMix(position.x, position.z, released).surf, now, 1.2);
  }

  function impact(position) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== 'running') return;
    const source = current.context.createBufferSource(), gain = current.context.createGain();
    const panner = spatialPanner(current.context, current.master, position);
    source.buffer = current.footsteps[1]; source.playbackRate.value = .55;
    gain.gain.value = .48;
    source.connect(gain).connect(panner); current.sources.push(source);
    source.onended = () => {
      source.disconnect(); gain.disconnect(); panner.disconnect();
      const index = current.sources.indexOf(source); if (index >= 0) current.sources.splice(index, 1);
    };
    source.start();
  }

  function bird(position) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== 'running') return;
    const now = current.context.currentTime, context = current.context;
    const tone = context.createOscillator(), gain = context.createGain();
    const panner = spatialPanner(context, current.master, position);
    tone.type = 'sine';
    tone.frequency.setValueAtTime(1700, now);
    tone.frequency.exponentialRampToValueAtTime(2900, now + .09);
    tone.frequency.exponentialRampToValueAtTime(2100, now + .21);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.035, now + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .24);
    tone.connect(gain).connect(panner); current.sources.push(tone);
    tone.onended = () => {
      tone.disconnect(); gain.disconnect(); panner.disconnect();
      const index = current.sources.indexOf(tone); if (index >= 0) current.sources.splice(index, 1);
    };
    tone.start(now); tone.stop(now + .25);
  }
  function discovery(position, bell = false) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== 'running') return;
    const { context } = current, now = context.currentTime;
    (bell ? [440, 880, 1192, 1760] : [660, 990]).forEach((frequency, index) => {
      const tone=context.createOscillator(), gain=context.createGain();
      const panner=spatialPanner(context,current.master,position), start=now+index*.09;
      tone.type='sine'; tone.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(.065,start+.018);
      gain.gain.exponentialRampToValueAtTime(.0001,start+(bell ? 3 : .65));
      tone.connect(gain).connect(panner); current.sources.push(tone);
      tone.onended=()=>{tone.disconnect();gain.disconnect();panner.disconnect();const i=current.sources.indexOf(tone);if(i>=0)current.sources.splice(i,1);};
      tone.start(start);tone.stop(start+(bell ? 3.1 : .7));
    });
  }
  function splash(position) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== 'running') return;
    const {context}=current, now=context.currentTime;
    const source=context.createBufferSource(), gain=context.createGain(), filter=context.createBiquadFilter();
    const buffer=context.createBuffer(1,Math.floor(context.sampleRate*.18),context.sampleRate);
    const samples=buffer.getChannelData(0);
    for(let i=0;i<samples.length;i++) samples[i]=(Math.random()*2-1)*(1-i/samples.length);
    source.buffer=buffer; filter.type='bandpass'; filter.frequency.value=1400; filter.Q.value=.7;
    const panner=spatialPanner(context,current.master,position);
    gain.gain.setValueAtTime(.12,now); gain.gain.exponentialRampToValueAtTime(.0001,now+.18);
    source.connect(filter).connect(gain).connect(panner); current.sources.push(source);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();panner.disconnect();const i=current.sources.indexOf(source);if(i>=0)current.sources.splice(i,1);};
    source.start();
  }
  function wind(position, strength, time, paused) {
    const current = audio.current;
    if (!enabledRef.current || !current || current.context.state !== 'running') return;
    current.wind.update(position, strength, time, paused);
    current.soundscape.update(position, paused);
  }
  return { toggle, speed, release, footstep, spatial, impact, bird, wind, discovery, splash, bell: position => discovery(position, true) };
}
