import bpy
rig=bpy.data.objects['Sankaran_Rig']
rig.animation_data.action=None
for t in rig.animation_data.nla_tracks:t.mute=True
for b in rig.pose.bones:
 b.rotation_mode='ZYX';b.location=(0,0,0);b.rotation_euler=(0,0,0);b.scale=(1,1,1)
bpy.data.objects['Sankaran_Body'].data.shape_keys.key_blocks['CarryGrip'].value=0
for eye_name in ['OvalEye_L','OvalEye_R']:
 bpy.data.objects[eye_name].data.shape_keys.key_blocks['Blink'].value=0
cloth=bpy.data.objects['Dhoti'].data.shape_keys
if cloth.animation_data:cloth.animation_data.action=None
for k in cloth.key_blocks:k.value=0
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for name in ['Sankaran_Rig','Sankaran_Body','Dhoti','Harness','OvalEye_L','OvalEye_R']:
 o=bpy.data.objects[name];o.hide_set(False);o.select_set(True)
bpy.context.view_layer.objects.active=rig
props=bpy.ops.export_scene.gltf.get_rna_type().properties
options=dict(filepath='/Users/sudhir/Desktop/create/experiment/port/public/models/sankaran-pillai.glb',use_selection=True,export_animations=True,export_skins=True,export_morph=True,export_optimize_animation_size=False,export_anim_slide_to_zero=True)
options['export_animation_mode']=next(i.identifier for i in props['export_animation_mode'].enum_items if i.identifier=='NLA_TRACKS')
if 'export_merge_animation' in props:options['export_merge_animation']=next(i.identifier for i in props['export_merge_animation'].enum_items if i.identifier=='NLA_TRACK')
bpy.ops.export_scene.gltf(**options)
bpy.data.objects['Sankaran_Body'].data.shape_keys.key_blocks['CarryGrip'].value=1
