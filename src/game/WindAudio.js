import { WIND_GROVES, sampleGust, windExposure } from './Atmosphere.js';
import { positionAudio, spatialPanner } from './SpatialAudio.js';
import { windDirection } from './WindField.js';

export function windAudioLevels(position, strength, time) {
  const exposure = windExposure(position.x, position.z);
  const gust = .7 + sampleGust(position.x, position.z, time) * .4;
  return {
    air: (.018 + strength * .065) * exposure * gust,
    rustle: WIND_GROVES.map(g => Math.max(0, 1 - Math.hypot(g.x - position.x, g.z - position.z) / 22) * strength * .18 * gust * exposure),
  };
}
export function createWindSamples(sampleRate, seconds = 4) {
  const data = new Float32Array(Math.round(sampleRate * seconds));
  let seed = 5729, low = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    low = .88 * low + .12 * (seed / 2147483648 - 1);
    const edge = Math.min(1, i / (sampleRate * .12), (data.length - 1 - i) / (sampleRate * .12));
    data[i] = low * edge;
  }
  return data;
}
export function createWindAudio(context, master) {
  const source = context.createBufferSource();
  const samples = createWindSamples(context.sampleRate);
  source.buffer = context.createBuffer(1, samples.length, context.sampleRate);
  source.buffer.copyToChannel(samples, 0); source.loop = true;
  const air = context.createBiquadFilter(); air.type = 'lowpass'; air.frequency.value = 800;
  const rustle = context.createBiquadFilter(); rustle.type = 'bandpass'; rustle.frequency.value = 1900; rustle.Q.value = .5;
  source.connect(air); source.connect(rustle);
  const airGain = context.createGain(); airGain.gain.value = 0;
  const airPanner = spatialPanner(context, master, { x: 0, y: 2, z: 0 });
  air.connect(airGain).connect(airPanner);
  const trees = WIND_GROVES.map(g => {
    const gain = context.createGain(); gain.gain.value = 0;
    const panner = spatialPanner(context, master, { x: g.x, y: g.height, z: g.z });
    rustle.connect(gain).connect(panner); return gain;
  });
  source.start();
  return { source, update(position, strength, time, paused) {
    const now = context.currentTime, levels = windAudioLevels(position, strength, time);
    positionAudio(airPanner, { x: position.x - windDirection.x * 3, y: (position.y ?? 0) + 2, z: position.z - windDirection.z * 3 }, now);
    airGain.gain.setTargetAtTime(paused ? 0 : levels.air, now, .3);
    trees.forEach((gain, i) => gain.gain.setTargetAtTime(paused ? 0 : levels.rustle[i], now, .4));
    air.frequency.setTargetAtTime(500 + strength * 800, now, .8);
  } };
}
