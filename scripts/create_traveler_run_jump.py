"""Bake reusable in-place Run and one-shot Jump clips at 24 fps."""
import bpy, math, json
rig=bpy.data.objects['Sankaran_Rig'];cloth=bpy.data.objects['Dhoti'].data.shape_keys
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:b.rotation_mode='ZYX'
def clamp(x):return max(-1,min(1,x))
def legs(side,forward,height,hip_height):
 down=hip_height-height
 distance=min(.669,max(.05,math.hypot(forward,down)))
 hip=math.atan2(-forward,down)+math.acos(clamp((.33*.33+distance*distance-.34*.34)/(.66*distance)))
 knee=-(math.pi-math.acos(clamp((.33*.33+.34*.34-distance*distance)/(.2244))))
 rig.pose.bones['thigh.'+side].location.y=.66-.78
 rig.pose.bones['thigh.'+side].rotation_euler.x=hip
 rig.pose.bones['shin.'+side].rotation_euler.x=knee
 rig.pose.bones['foot.'+side].rotation_euler.x=-hip-knee

def reset():
 for b in rig.pose.bones:b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
def new_action(owner,name):
 owner.animation_data_create();owner.animation_data.action=None
 for t in list(owner.animation_data.nla_tracks):
  if t.name==name:owner.animation_data.nla_tracks.remove(t)
 a=bpy.data.actions.new(name+' authored');a.use_fake_user=True;owner.animation_data.action=a;return a

def finish(owner,name,action):
 t=owner.animation_data.nla_tracks.new();t.name=name;t.strips.new(name,1,action);t.mute=True;owner.animation_data.action=None
samples={}
for name,last in [('Run',41),('Jump',37),('JumpRun',37)]:
 action=new_action(rig,name);samples[name]=[]
 for frame in range(1,last+1):
  reset();t=(frame-1)/24;body=rig.pose.bones['body']
  if name=='Run':
   phase=(frame-1)/40*2*math.pi
   bounce=.018*(1-math.cos(phase*2))
   rig.pose.bones['root'].location.y=bounce;body.location.y=-.04;body.rotation_euler.x=.035
   body.rotation_euler.y=.025*math.sin(phase);body.rotation_euler.z=.012*math.sin(phase)
   for i,side in enumerate(['L','R']):
    cycle=((frame-1)/40+i*.5)%1
    if cycle<.35:
     u=cycle/.35;forward=.28*(-1+2*u);height=.07
    else:
     u=(cycle-.35)/.65
     tangent=2*.65/.35
     forward=.28*(1+tangent*u+(-6-3*tangent)*u*u+(4+2*tangent)*u*u*u)
     height=.07+.13*math.sin(math.pi*u)**2
    legs(side,forward,height,.66+bounce)
    arm=rig.pose.bones['upper_arm.'+side];arm.rotation_euler.x=-.38*math.cos(phase+i*math.pi);arm.rotation_euler.z=(-1 if i==0 else 1)*.12
    rig.pose.bones['forearm.'+side].rotation_euler.x=.45+.08*math.sin(phase+i*math.pi)
   weights=[0,.5+.5*math.cos(phase),.5-.5*math.cos(phase)]
  else:
   # Shared takeoff/landing clock permits continuous idle-to-running jump blends.
   moving=name=='JumpRun';lift=0;compression=0;tuck=0;flight=0;arm_angle=0
   if t<.2:
    u=t/.2;compression=-.075*math.sin(math.pi*u)**2;arm_angle=.16*math.sin(math.pi*u)**2
   elif t<1.0:
    u=(t-.2)/.8;flight=math.sin(math.pi*u)**2
    lift=.44*4*u*(1-u);tuck=.09*flight;arm_angle=-.42*math.sin(math.pi*u)
   else:
    u=(t-1.0)/.5;compression=-.065*math.sin(math.pi*u)**2;arm_angle=.10*math.sin(math.pi*u)**2
   rig.pose.bones['root'].location.y=lift+compression
   body.location.y=-.045;body.rotation_euler.x=(.12 if moving else .025)*flight
   rig.pose.bones['head'].rotation_euler.x=-.04*flight
   for i,side in enumerate(['L','R']):
    # A leading knee and trailing leg for travel; symmetric tuck when stationary.
    forward=((-.13 if i==0 else .13)*flight) if moving else 0
    foot_tuck=tuck*((1.25 if i==0 else .65) if moving else 1)
    legs(side,forward,.11+lift+foot_tuck,.70+lift+compression)
    rig.pose.bones['thigh.'+side].location.y=.70-.78
    arm=rig.pose.bones['upper_arm.'+side]
    arm.rotation_euler.x=arm_angle+((.18 if i==0 else -.18)*flight if moving else 0)
    arm.rotation_euler.z=(-1 if i==0 else 1)*(.10+.06*flight)
    rig.pose.bones['forearm.'+side].rotation_euler.x=.12+.3*flight
   weights=[0,tuck*2.5,tuck*1.5] if moving else [0,tuck*2,tuck*2]
  for bone in rig.pose.bones:
   bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_euler',frame=frame);bone.keyframe_insert('scale',frame=frame)
  samples[name].append((frame,weights))
 finish(rig,name,action)
 action=new_action(cloth,name)
 for frame,weights in samples[name]:
  for key,value in zip(['Seated','StrideLeft','StrideRight'],weights):
   cloth.key_blocks[key].value=value;cloth.key_blocks[key].keyframe_insert('value',frame=frame)
 finish(cloth,name,action)
reset()
for key in cloth.key_blocks:key.value=0
bpy.context.scene.render.fps=24
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=37
bpy.context.scene.frame_set(1)
print('Run: 40-frame seamless cycle, 1.6 metres per cycle; Jump: 36-frame anticipation, takeoff, landing and recovery')
print('MOTION_SAMPLES',json.dumps(samples))
