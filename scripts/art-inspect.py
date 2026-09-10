import bpy,pathlib,json
root=pathlib.Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for pattern in ['**/Superhero_Female_FullBody.gltf','**/Female_Peasant.gltf','**/UAL1_Standard.glb']:
    path=next((root/'art/vendor').glob(pattern));bpy.ops.import_scene.gltf(filepath=str(path))
    print('SOURCE',path.name)
    for o in bpy.context.selected_objects:
        print(o.name,o.type,tuple(o.dimensions),tuple(o.location))
        if o.type=='ARMATURE':
            print('BONES',[(b.name,tuple(b.head_local)) for b in o.data.bones if any(t in b.name.lower() for t in ['head','hand','hips','root','spine'])])
    print('ACTIONS',[a.name for a in bpy.data.actions])
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
