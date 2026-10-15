"""Two-second planted relief: let go, exhale, straighten, settle. 24 fps."""
import bpy, math
rig=bpy.data.objects['Sankaran_Rig']
rig.animation_data.action=None
for track in list(rig.animation_data.nla_tracks):
 if track.name=='Relief':rig.animation_data.nla_tracks.remove(track)
 else:track.mute=True
action=bpy.data.actions.new('Relief authored');action.use_fake_user=True
rig.animation_data.action=action
# Pose landmarks: seconds, lean, head nod, arm spread, arm swing, compression.
poses=[(0,.16,0,.32,0,0),(.25,.17,.035,.27,.045,-.008),(.72,.11,.10,.14,.065,-.025),(1.35,-.025,-.035,.09,-.045,0),(2,0,0,.06,0,0)]
for frame in range(1,50):
 t=(frame-1)/24
 for bone in rig.pose.bones:
  bone.rotation_mode='ZYX';bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)
 a,b=next((poses[i],poses[i+1]) for i in range(len(poses)-1) if poses[i][0]<=t<=poses[i+1][0])
 u=(t-a[0])/(b[0]-a[0]);u=u*u*u*(u*(u*6-15)+10)
 lean,nod,spread,swing,compress=[a[i]+(b[i]-a[i])*u for i in range(1,6)]
 rig.pose.bones['root'].location.y=compress
 body=rig.pose.bones['body'];body.location.y=-.045;body.rotation_euler.x=lean
 rig.pose.bones['head'].rotation_euler.x=nod
 breath=math.sin(math.pi*min(1,t/1.5))**2 if t<1.5 else 0
 for i,side in enumerate(['L','R']):
  # Solve the two leg links against fixed feet, so the exhale never slides them.
  down=.59+compress;d=min(.669,max(.05,down))
  hip=math.acos(max(-1,min(1,(.33**2+d*d-.34**2)/(.66*d))))
  knee=-(math.pi-math.acos(max(-1,min(1,(.33**2+.34**2-d*d)/(.2244)))))
  thigh=rig.pose.bones['thigh.'+side];thigh.location.y=.70-.78;thigh.rotation_euler.x=hip
  rig.pose.bones['shin.'+side].rotation_euler.x=knee
  rig.pose.bones['foot.'+side].rotation_euler.x=-hip-knee
  arm=rig.pose.bones['upper_arm.'+side];arm.rotation_euler.z=(-1 if i==0 else 1)*spread;arm.rotation_euler.x=swing
  arm.location.y=-.012*breath
  rig.pose.bones['forearm.'+side].rotation_euler.x=.12+.035*breath
 for bone in rig.pose.bones:
  bone.keyframe_insert('location',frame=frame);bone.keyframe_insert('rotation_euler',frame=frame);bone.keyframe_insert('scale',frame=frame)
track=rig.animation_data.nla_tracks.new();track.name='Relief';track.strips.new('Relief',1,action);track.mute=True
cloth=bpy.data.objects['Dhoti'].data.shape_keys
cloth.animation_data.action=None
for track in cloth.animation_data.nla_tracks:track.mute=True
for key in cloth.key_blocks:key.value=0
bpy.context.scene.frame_start=1;bpy.context.scene.frame_end=49;bpy.context.scene.render.fps=24
bpy.context.scene.frame_set(18)
print('Created Relief: 49 samples, 2 seconds, planted feet, all rig bones.')
