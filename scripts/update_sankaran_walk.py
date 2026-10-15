"""Bake the sampled gameplay gait into the existing rig without rebuilding meshes.
Run sample-traveler-walk.mjs first. For MCP safe mode, supply SAMPLES inline.
"""
import bpy
import json
from pathlib import Path
SAMPLES = json.loads((Path(__file__).resolve().parent.parent/'assets/characters/walk-cycle.json').read_text())
garment=bpy.data.objects['Dhoti']
keys=garment.data.shape_keys
for side,name in [(-1,'StrideLeft'),(1,'StrideRight')]:
    shape=keys.key_blocks.get(name) or garment.shape_key_add(name=name)
    for dest,base in zip(shape.data,keys.key_blocks['Basis'].data):
        x,y,z=base.co
        t=max(0,min(1,(.91-z)/.78))
        front=max(0,min(1,(y-.04)/.22))
        lateral=max(0,1-abs(x-side*.15)/.3)
        dest.co=(x,y+.10*front*lateral*t**1.5,z+.025*front*lateral*t*t)
keys.animation_data.action=None
old=next((t for t in keys.animation_data.nla_tracks if t.name=='Walk'),None)
if old:keys.animation_data.nla_tracks.remove(old)
cloth_action=bpy.data.actions.new('Walk cloth');keys.animation_data.action=cloth_action
for sample in SAMPLES:
    for name,value in [('Seated',0),('StrideLeft',sample['cloth'][0]),('StrideRight',sample['cloth'][1])]:
        keys.key_blocks[name].value=value;keys.key_blocks[name].keyframe_insert('value',frame=sample['frame'])
cloth_track=keys.animation_data.nla_tracks.new();cloth_track.name='Walk';cloth_track.strips.new('Walk',1,cloth_action);cloth_track.mute=True
keys.animation_data.action=None
for shape in keys.key_blocks:shape.value=0
rig=bpy.data.objects['Sankaran_Rig']
rig.animation_data.action=None
track=next(t for t in rig.animation_data.nla_tracks if t.name=='Walk')
for strip in list(track.strips):track.strips.remove(strip)
action=bpy.data.actions.new('Walk grounded');action.use_fake_user=True
rig.animation_data.action=action
# Blender ZYX produces the same local rotation as Three.js XYZ.
order=next(i.identifier for i in bpy.types.PoseBone.bl_rna.properties['rotation_mode'].enum_items if i.identifier=='ZYX')
for bone in rig.pose.bones:bone.rotation_mode=order
for sample in SAMPLES:
    frame=sample['frame'];upper=sample['upper']
    for bone in rig.pose.bones:
        bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)
    body=rig.pose.bones['body'];body.location.y=-.045+upper['bob'];body.rotation_euler.z=upper['sway'];body.rotation_euler.y=upper['twist']
    for i,side in enumerate(('L','R')):
        leg=sample['legs'][i]
        hip=rig.pose.bones['thigh.'+side];hip.location.y=sample['hipHeight']-.78;hip.rotation_euler.x=leg['hip']
        rig.pose.bones['shin.'+side].rotation_euler.x=leg['knee']
        rig.pose.bones['foot.'+side].rotation_euler.x=leg['ankle']
        arm=rig.pose.bones['upper_arm.'+side];arm.rotation_euler.x=upper['arm']*(1 if i==0 else -1);arm.rotation_euler.z=-.06 if i==0 else .06
        rig.pose.bones['forearm.'+side].rotation_euler.x=sample['elbows'][i]
    for bone in rig.pose.bones:
        bone.keyframe_insert('location',frame=frame)
        bone.keyframe_insert('rotation_euler',frame=frame)
        bone.keyframe_insert('scale',frame=frame)
track.strips.new('Walk',1,action);track.mute=True
rig.animation_data.action=None
for bone in rig.pose.bones:
    bone.location=(0,0,0);bone.rotation_euler=(0,0,0);bone.scale=(1,1,1)
bpy.data.objects['Dhoti'].data.shape_keys.key_blocks['Seated'].value=0
bpy.data.objects['Harness'].hide_set(False);bpy.data.objects['Harness'].hide_render=False
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for obj in bpy.data.collections['Sankaran_Character'].objects:obj.select_set(True)
bpy.context.view_layer.objects.active=rig
props=bpy.ops.export_scene.gltf.get_rna_type().properties
options=dict(filepath='/Users/sudhir/Desktop/create/experiment/port/public/models/sankaran-pillai.glb',use_selection=True,export_animations=True,export_skins=True,export_morph=True,export_optimize_animation_size=False,export_anim_slide_to_zero=True)
options['export_animation_mode']=next(i.identifier for i in props['export_animation_mode'].enum_items if i.identifier=='NLA_TRACKS')
if 'export_merge_animation' in props:options['export_merge_animation']=next(i.identifier for i in props['export_merge_animation'].enum_items if i.identifier=='NLA_TRACK')
bpy.ops.export_scene.gltf(**options)
# Leave Blender ready to preview the updated walk. Other clips remain muted.
rig.animation_data.action=action
keys.animation_data.action=cloth_action
bpy.data.objects['Dhoti'].data.shape_keys.key_blocks['Seated'].value=0
bpy.data.objects['Harness'].hide_set(True);bpy.data.objects['Harness'].hide_render=True
scene=bpy.context.scene;scene.render.fps=24;scene.frame_start=1;scene.frame_end=24;scene.frame_set(7)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath='/Users/sudhir/Desktop/create/experiment/port/assets/characters/sankaran-pillai.blend')
print('Updated Walk clip: planted stance, smooth return, toe clearance, opposing arms, body sway. Blender is on frame 7 of the walk.')
