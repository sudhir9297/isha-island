import { AnimationMixer, LoopOnce } from 'three';
import { RUN_CYCLE_DISTANCE } from './TravelerRun.js';

// Sample the Blender clips after the procedural walking/seated pose. Restore
// their bindings before the next procedural frame so no jump offset survives.
export function createTravelerMotion(scene, clips) {
  const mixer = new AnimationMixer(scene);
  const bones = [];
  scene.traverse(node => { if (node.isBone) bones.push(node); });
  let previous;
  let targets;
  let currentName, previousName;
  const capture = () => bones.map(bone => ({ position: bone.position.clone(), quaternion: bone.quaternion.clone() }));
  const actions = Object.fromEntries(['Run', 'Jump', 'JumpRun', 'Relief'].map(name => {
    const clip = clips.find(item => item.name === name);
    if (!clip) throw new Error(`Missing traveler ${name} animation`);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1);
    action.clampWhenFinished = true;
    return [name, action];
  }));
  return {
    reset() {
      if (targets) bones.forEach((bone, i) => {
        bone.position.copy(targets[i].position);
        bone.quaternion.copy(targets[i].quaternion);
      });
      targets = null;
      currentName = null;
      mixer.stopAllAction();
    },
    sampleRun(distance) {
      this.sample('Run', distance / RUN_CYCLE_DISTANCE * actions.Run.getClip().duration);
    },
    sampleJump(time, distance, travelBlend, running) {
      // Keep the live locomotion pose for takeoff and recovery, including run phase.
      if (running) this.sampleRun(distance);
      const base = capture();
      mixer.stopAllAction();
      const blend = Math.max(0, Math.min(1, travelBlend));
      actions.Jump.reset().setEffectiveWeight(1-blend).play();
      actions.JumpRun.reset().setEffectiveWeight(blend).play();
      mixer.setTime(Math.min(time, actions.Jump.getClip().duration));
      currentName = 'Jump';
      const ease = u => { u=Math.max(0,Math.min(1,u)); return u*u*(3-2*u); };
      const weight = ease(time/.14)*(1-ease((time-1.04)/.32));
      bones.forEach((bone,i) => {
        // Root height follows the jump arc even while the landing pose blends out.
        if (bone.name === 'root' && time >= .2 && time < 1) return;
        bone.position.lerpVectors(base[i].position,bone.position.clone(),weight);
        bone.quaternion.slerpQuaternions(base[i].quaternion,bone.quaternion.clone(),weight);
      });
    },
    sample(name, time, weight = 1) {
      currentName = name;
      const action = actions[name];
      action.reset().setEffectiveWeight(weight).play();
      mixer.setTime(name === 'Run' ? time % action.getClip().duration : Math.min(time, action.getClip().duration));
    },
    smooth(delta) {
      targets = capture();
      const alpha = 1 - Math.exp(-Math.max(0, delta) / .055);
      if (previous) bones.forEach((bone, i) => {
        // Filtering planted feet creates lag against world movement. Preserve the
        // authored contact trajectories once the run transition has begun.
        if ((currentName === 'Run' || currentName === 'Jump') && previousName === currentName && /^(root|thigh|shin|foot)/.test(bone.name)) return;
        bone.position.lerpVectors(previous[i].position, targets[i].position, alpha);
        bone.quaternion.slerpQuaternions(previous[i].quaternion, targets[i].quaternion, alpha);
      });
      previous = capture();
      previousName = currentName;
    },
  };
}
