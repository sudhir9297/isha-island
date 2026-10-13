"""Run with Blender --background SOURCE.blend --python this_file.
Exports only the user-provided gate architecture. Never saves or edits SOURCE.blend.
"""
import bpy, json, os, math, hashlib
from mathutils import Matrix, Vector

OUTPUT = '/Users/sudhir/Desktop/create/experiment/port/public/models/malai-vasal-day-v2.glb'
SCALE = 0.79
selected_collections = {'MV | Architecture', 'MV | Metalwork', 'MV2 | Stone and masonry', 'MV2 | Gate hardware'}
source_path = bpy.data.filepath
source_hash = hashlib.sha256(open(source_path,'rb').read()).hexdigest()
originals = list(bpy.context.scene.objects)
deps = bpy.context.evaluated_depsgraph_get()
collection = bpy.data.collections.new('Port gate export'); bpy.context.scene.collection.children.link(collection)
batches = {}
source_names = []
for original in originals:
    groups = {c.name for c in original.users_collection}
    if original.hide_render or original.type not in {'MESH', 'CURVE'}: continue
    if original.name not in {'top_rock', 'side_rock_gate', 'linga'} and not groups.intersection(selected_collections): continue
    evaluated = original.evaluated_get(deps)
    data = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=deps)
    obj = bpy.data.objects.new('Export_' + original.name, data); collection.objects.link(obj)
    obj.matrix_world = original.matrix_world.copy()
    source_names.append(original.name)
    role = 'Boulder' if original.name == 'top_rock' else 'GraniteSupports' if original.name == 'side_rock_gate' else 'Finial' if original.name == 'linga' else 'Metalwork' if groups.intersection({'MV | Metalwork', 'MV2 | Gate hardware'}) else 'StoneDetails' if 'MV2 | Stone and masonry' in groups else 'Walls'
    batches.setdefault(role, []).append(obj)
for original in originals: original.hide_render = True
bpy.context.scene.cycles.samples = 1
bpy.context.scene.cycles.device = 'CPU'
bpy.context.scene.render.threads_mode = 'FIXED'; bpy.context.scene.render.threads = 4

def activate(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj

def bake_color(obj, name):
    activate(obj)
    if name == 'GraniteSupports':
        dec = obj.modifiers.new('Browser stone detail', 'DECIMATE'); dec.ratio = 0.24
        bpy.ops.object.modifier_apply(modifier=dec.name)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.22, island_margin=0.01)
    bpy.ops.object.mode_set(mode='OBJECT')
    image = bpy.data.images.new('Port_' + name + '_Color', width=1024, height=1024, alpha=False)
    old_materials = list(obj.data.materials)
    for mat in old_materials:
        node = mat.node_tree.nodes.new('ShaderNodeTexImage'); node.image=image
        mat.node_tree.nodes.active=node
    bpy.context.scene.render.bake.use_pass_direct=False
    bpy.context.scene.render.bake.use_pass_indirect=False
    bpy.context.scene.render.bake.use_pass_color=True
    bpy.context.scene.render.bake.margin=12
    image_path='/private/tmp/Port_' + name + '_Color.png'
    cache_meta=image_path + '.source'
    cache_valid=os.path.isfile(image_path) and os.path.isfile(cache_meta) and open(cache_meta).read()==source_hash
    if cache_valid:
        image=bpy.data.images.load(image_path, check_existing=False)
    else:
        bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
        image.filepath_raw=image_path; image.file_format='PNG'; image.save()
        with open(cache_meta,'w') as f:f.write(source_hash)
    mat=bpy.data.materials.new('Source baked ' + name); mat.use_nodes=True
    principled=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    mat.node_tree.links.new(tex.outputs['Color'],principled.inputs['Base Color'])
    principled.inputs['Roughness'].default_value=0.91
    obj.data.materials.clear(); obj.data.materials.append(mat)
    for face in obj.data.polygons: face.material_index=0
    print('BAKED',name,len(obj.data.vertices),len(obj.data.polygons),flush=True)

for role in ['Boulder', 'GraniteSupports']:
    bake_color(batches[role][0], role)
# Convert the remaining procedural materials to their authored base / ramp color.
for role, objects in batches.items():
    if role in {'Boulder','GraniteSupports'}: continue
    for obj in objects:
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes: continue
            p=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
            if not p: continue
            ramps=[n for n in mat.node_tree.nodes if n.type=='VALTORGB']
            if ramps and p.inputs['Base Color'].is_linked:
                ramp=ramps[-1].color_ramp
                color=ramp.evaluate(0.5)
                p.inputs['Base Color'].default_value=color
            for socket in [p.inputs['Base Color'],p.inputs['Normal'],p.inputs['Roughness']]:
                for link in list(socket.links): mat.node_tree.links.remove(link)
# Normalize in Blender coordinates. glTF converts Blender Z-up to browser Y-up.
transform = Matrix(((0,SCALE,0,0),(-SCALE,0,0,1.6*SCALE),(0,0,SCALE,-2.60*SCALE),(0,0,0,1)))
exported=[]
for role, objects in batches.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    if len(objects)>1: bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active; obj.name='MalaiVasal_' + role
    obj.matrix_world=transform @ obj.matrix_world
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    exported.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in exported: obj.select_set(True)
opts=bpy.ops.export_scene.gltf.get_rna_type().properties
from io_scene_gltf2 import get_format_items
format_id=next(item[0] for item in get_format_items(None,bpy.context) if '.glb' in item[1])
bpy.ops.export_scene.gltf(filepath=OUTPUT,export_format=format_id,use_selection=True,export_apply=True,export_materials='EXPORT',export_extras=True)
metadata={'source':source_path,'source_sha256':source_hash,'source_object_count':len(source_names),'source_objects':source_names,'scale':SCALE,'normalization':{'source_center_x':1.6,'source_floor_z':2.60,'browser_axes':['source Y','source Z','source X']},'baked_materials':['Boulder','GraniteSupports'],'parts':[o.name for o in exported]}
with open(OUTPUT.replace('.glb','.json'),'w') as f:json.dump(metadata,f,indent=2)
print('EXPORTED',OUTPUT,os.path.getsize(OUTPUT),flush=True)
