export const SOUND_REGIONS = [
  {id:'shore',x:0,z:-7,frequency:850,volume:.045},
  {id:'grove',x:64,z:-48,frequency:3100,volume:.018},
  {id:'stone',x:130,z:-69,frequency:260,volume:.035},
];
export function soundscapeMix(position,paused=false) {
  return SOUND_REGIONS.map(region=>{
    const t=Math.max(0,Math.min(1,(28-Math.hypot(position.x-region.x,position.z-region.z))/18));
    return paused?0:t*t*(3-2*t);
  });
}
// Shared noise, three restrained filters: shore wash, grove insects, low open breeze.
export function createIslandSoundscape(context,destination) {
  const buffer=context.createBuffer(1,context.sampleRate*3,context.sampleRate);
  const samples=buffer.getChannelData(0);
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
  const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
  const gains=SOUND_REGIONS.map(region=>{
    const filter=context.createBiquadFilter(),gain=context.createGain();
    filter.type='bandpass';filter.frequency.value=region.frequency;filter.Q.value=region.id==='grove'?12:.6;
    gain.gain.value=0;source.connect(filter).connect(gain).connect(destination);return gain;
  });
  source.start();
  return {source,update(position,paused){
    const mix=soundscapeMix(position,paused),now=context.currentTime;
    gains.forEach((gain,i)=>{
      const pulse=i===1?.45+.55*Math.sin(now*9)**8:.85+.15*Math.sin(now*.7+i);
      gain.gain.setTargetAtTime(mix[i]*SOUND_REGIONS[i].volume*pulse,now,paused?.08:.8);
    });
  }};
}
