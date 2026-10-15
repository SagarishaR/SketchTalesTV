import bpy
import math
import random
from pathlib import Path
from mathutils import Vector

# ============================================================
# SKETCHTALES TV — ENCHANTED FOREST ENVIRONMENT
# Fully procedural scene. No external models or textures.
# ============================================================

random.seed(42)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "backend/public/scenes/blender-forest-preview.png"
CHARACTER = ROOT / "backend/test-assets/elephant-cutout.png"

if not CHARACTER.exists():
    raise RuntimeError(f"Missing character image: {CHARACTER}")

# Clean scene
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

scene = bpy.context.scene
scene.render.engine = "CYCLES" if False else "BLENDER_EEVEE"
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.film_transparent = False
scene.render.filepath = str(OUT)
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 48

scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world.color = (.025, .045, .055)

# ------------------------- MATERIALS -------------------------

def mat(name, color, rough=.8, metallic=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    return m

def textured(name, color, scale=5, strength=.15, distance=.08):
    m = mat(name, color)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    b = nodes.get("Principled BSDF")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 4
    noise.inputs["Roughness"].default_value = .72
    ramp = nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = .18
    ramp.color_ramp.elements[0].color = (
        color[0]*.48, color[1]*.48, color[2]*.48, 1)
    ramp.color_ramp.elements[1].position = .8
    ramp.color_ramp.elements[1].color = (
        min(color[0]*1.45,1), min(color[1]*1.45,1),
        min(color[2]*1.45,1), 1)
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m

bark = textured("Rich ridged chestnut bark", (.23,.105,.052), 4, .25, .12)
bark_light = mat("Warm bark highlights", (.40,.20,.09))
bark_dark = mat("Bark creases", (.085,.038,.025))
wood = textured("Handcrafted door oak", (.35,.13,.045), 7, .15)
gold = mat("Antique golden trim", (.8,.43,.10), .35, .25)
ground_mat = textured("Velvet moss earth", (.065,.16,.085), 3, .23)
path_mat = textured("Warm forest soil path", (.29,.18,.105), 7, .12)
stone_mat = textured("Weathered mossy stone", (.22,.28,.22), 5, .18)
leaf_mats = [
    textured("Deep emerald foliage", (.025,.12,.065), 5, .07),
    textured("Forest jade foliage", (.045,.22,.105), 5, .08),
    textured("Sunlit leaf green", (.17,.34,.13), 6, .06),
    textured("Golden olive foliage", (.29,.36,.13), 6, .06),
]
fern_mats = [
    mat("Fern green", (.055,.24,.105)),
    mat("Fern light", (.18,.39,.15)),
]
flower_mats = [
    mat("Wildflower gold", (.98,.57,.10), .45),
    mat("Wildflower pink", (.88,.25,.35), .45),
    mat("Wildflower ivory", (.95,.84,.60), .5),
]
dark = mat("Deep doorway recess", (.035,.025,.025))
door_glow = mat("Portal inner glow", (.95,.43,.12), .3)
door_glow.use_nodes = True
db = door_glow.node_tree.nodes.get("Principled BSDF")
db.inputs["Emission Color"].default_value = (1.0,.25,.045,1)
db.inputs["Emission Strength"].default_value = 2.0

def assign(obj, material):
    obj.data.materials.append(material)
    return obj

def smooth(obj):
    if obj.type == "MESH":
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj

def uv(name, loc, scale, material, seg=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=rings, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    assign(o, material)
    smooth(o)
    return o

def ico(name, loc, scale, material, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=subdivisions, radius=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    assign(o, material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o

def cube(name, loc, scale, material, bevel=.05):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = scale
    bpy.ops.object.transform_apply(
        location=False, rotation=False, scale=True)
    assign(o, material)
    if bevel:
        mod = o.modifiers.new("Rounded crafted edges", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        o.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
    return o

def cylinder_between(name, a, b, r1, r2, material, vertices=10):
    a, b = Vector(a), Vector(b)
    d = b-a
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=r1, radius2=r2,
        depth=d.length, location=(a+b)*.5)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat("Z","Y").to_euler()
    assign(o, material)
    return o

def curve_line(name, points, radius, material):
    c = bpy.data.curves.new(name, "CURVE")
    c.dimensions = "3D"
    c.resolution_u = 12
    c.bevel_depth = radius
    c.bevel_resolution = 3
    s = c.splines.new("BEZIER")
    s.bezier_points.add(len(points)-1)
    for bp, p in zip(s.bezier_points, points):
        bp.co = p
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new(name, c)
    scene.collection.objects.link(o)
    assign(o, material)
    return o

# ------------------------- TERRAIN --------------------------

# Dense gently undulating terrain instead of a flat box.
verts, faces = [], []
nx, ny = 45, 38
for j in range(ny+1):
    y = -7 + j*12/ny
    for i in range(nx+1):
        x = -10 + i*20/nx
        z = -.13 + .045*math.sin(x*1.1+y*.65)
        z += .025*math.sin(y*2+x*.7)
        verts.append((x,y,z))
for j in range(ny):
    for i in range(nx):
        a = j*(nx+1)+i
        faces.append((a,a+1,a+nx+2,a+nx+1))
mesh = bpy.data.meshes.new("Rolling terrain mesh")
mesh.from_pydata(verts, [], faces)
mesh.materials.append(ground_mat)
terrain = bpy.data.objects.new("Continuous rolling forest floor", mesh)
scene.collection.objects.link(terrain)
for p in mesh.polygons:
    p.use_smooth = True
solid = terrain.modifiers.new("Earth depth", "SOLIDIFY")
solid.thickness = .4

# Winding path built from tapered segments.
path_points = [
    (-.15, -7, -.005), (.05,-5,-.005), (-.15,-3,-.005),
    (-.6,-1,-.005), (-.75,1,-.005), (-.35,3,-.005)
]
for i in range(len(path_points)-1):
    a, b = Vector(path_points[i]), Vector(path_points[i+1])
    mid = (a+b)*.5
    o = cube("Winding story path", mid, (1.75,(b-a).length,.055), path_mat,.08)
    o.rotation_euler[2] = math.atan2((b-a).x,(b-a).y)

# -------------------- DISTANT FOREST ------------------------

# Distant trees are rooted below the horizon, with irregular overlapping
# crowns. Their silhouettes vary in height, width, and depth.
for i in range(25):
    x = -11 + i*.92 + random.uniform(-.25,.25)
    y = random.uniform(4.5,6.8)
    h = random.uniform(3.4,6.0)
    base = random.uniform(-.25,.1)
    trunk_h = h*.58
    trunk_r = random.uniform(.10,.20)
    cylinder_between(
        "Rooted distant tree trunk",
        (x,y,base),(x+random.uniform(-.18,.18),y,base+trunk_h),
        trunk_r,trunk_r*.38,bark_dark,8)
    for k in range(3):
        z = base+trunk_h*.48+k*h*.13
        width = h*random.uniform(.23,.33)*(1-k*.16)
        crown = ico("Irregular distant canopy",
                    (x+random.uniform(-.22,.22),y,z),
                    (width,width*.48,h*.27),
                    random.choice(leaf_mats[:2]),2)
        crown.rotation_euler[1] = random.uniform(-.2,.2)

# Foreground trees frame the scene instead of forming a straight wall.
for x, y, h in [(-7.4,1.9,5.8),(7.6,2.6,5.5)]:
    cylinder_between("Framing tree trunk",(x,y,0),(x+.25,y,h),
                     .42,.20,bark,12)
    for k in range(5):
        z = h*.48+k*.48
        uv("Framing tree crown",
           (x+random.uniform(-.6,.6),y,z),
           (random.uniform(.65,1.05),.58,random.uniform(.55,.9)),
           random.choice(leaf_mats),16,10)

# -------------------- ANCIENT TREE --------------------------

# A tapered trunk with gently wandering cross-sections.
tx, ty = -3.25, 1.55
rings = 16
sides = 24
verts, faces = [], []
for j in range(rings+1):
    t = j/rings
    z = .02+t*6.25
    radius = 1.02*(1-t)**.72+.08
    cx = tx+.28*math.sin(t*3.2)
    cy = ty+.12*math.sin(t*4)
    for i in range(sides):
        a = 2*math.pi*i/sides
        variation = 1+.075*math.sin(i*3+j*.8)
        verts.append((
            cx+radius*math.cos(a)*variation,
            cy+radius*.78*math.sin(a)*variation,
            z
        ))
for j in range(rings):
    for i in range(sides):
        a=j*sides+i
        b=j*sides+(i+1)%sides
        faces.append((a,b,b+sides,a+sides))
faces.append(tuple(range(sides-1,-1,-1)))
faces.append(tuple(rings*sides+i for i in range(sides)))
mesh = bpy.data.meshes.new("Ancient trunk sculpt mesh")
mesh.from_pydata(verts, [], faces)
mesh.materials.append(bark)
trunk = bpy.data.objects.new("Ancient crooked tree trunk",mesh)
scene.collection.objects.link(trunk)
smooth(trunk)
sub = trunk.modifiers.new("Organic trunk smoothing","SUBSURF")
sub.levels = 1
sub.render_levels = 1

# Spreading roots visibly touch the earth.
for i in range(9):
    a = i*2*math.pi/9
    start = (tx,ty,.32)
    end = (tx+math.cos(a)*random.uniform(1.2,2.0),
           ty+math.sin(a)*random.uniform(.7,1.35),.02)
    mid = ((start[0]+end[0])*.5,
           (start[1]+end[1])*.5,.16)
    curve_line("Thick spreading tree root",
               [start,mid,end],random.uniform(.10,.19),bark)


# Thick branches physically overlap the trunk before extending outward.
# Their attachment points sit inside the trunk silhouette.
for i in range(7):
    z = random.uniform(4.0, 5.9)
    side = random.choice([-1, 1])
    radius = 1.02*(1-z/6.25)**.72+.08
    surface_x = tx + .28*math.sin((z/6.25)*3.2)
    p0 = (surface_x + side*radius*.45, ty, z)
    p1 = (surface_x + side*radius*.95, ty-.02, z+.20)
    p2 = (surface_x + side*(radius+0.65), ty+.02,
          z+random.uniform(.35,.8))
    p3 = (surface_x + side*(radius+1.15), ty+.04,
          z+random.uniform(.55,1.0))
    # The first segment starts inside the trunk; thicker roots at the
    # connection conceal small gaps and make the branch appear attached.
    curve_line("Branch collar", [p0,p1], .27, bark)
    curve_line("Tapered living branch", [p1,p2,p3], .17, bark)
    uv("Branch junction swelling", p1, (.25,.24,.25), bark, 12, 8)

# Bark ridges follow the tree's irregular silhouette.
for i in range(22):
    a = 2*math.pi*i/22
    pts=[]
    for j in range(5):
        t=.12+j*.18
        z=t*6.1
        radius=1.02*(1-t)**.72+.08
        cx=tx+.28*math.sin(t*3.2)
        cy=ty+.12*math.sin(t*4)
        aa=a+.035*math.sin(j*1.7+i)
        pts.append((cx+radius*math.cos(aa)*1.012,
                    cy+radius*.79*math.sin(aa),
                    z))
    curve_line("Raised natural bark ridge",pts,.018,bark_light)

# Main canopy: broad, overlapping irregular masses rather than spheres
# arranged in a straight row.
canopy = [
    (-5.0,1.7,6.2,1.5,1.05),
    (-4.1,2.2,7.0,1.55,1.0),
    (-2.8,2.4,7.35,1.55,1.05),
    (-1.4,2.6,6.9,1.65,1.0),
    (-.4,2.5,6.2,1.4,1.0),
    (-3.8,2.8,5.8,1.35,.9),
]
for cx,cy,cz,rx,rz in canopy:
    for i in range(9):
        loc=(cx+random.uniform(-rx,rx),
             cy+random.uniform(-.35,.35),
             cz+random.uniform(-rz,rz))
        size=random.uniform(.38,.65)
        o=ico("Sculpted leaf canopy cluster",loc,
              (size,size*.68,size*.62),random.choice(leaf_mats),2)
        o.rotation_euler[1]=random.uniform(-.3,.3)
        o.rotation_euler[2]=random.uniform(-.5,.5)

# -------------------- DOOR IN THE TREE ----------------------

# Dark inset and arched top.
uv("Door shadow", (tx+.10,.47,1.25),(.73,.13,1.25),dark,24,16)
cube("Door lower panel",(tx+.10,.30,.93),(1.05,.18,1.42),wood,.10)
uv("Rounded door arch",(tx+.10,.30,1.65),(.53,.10,.63),wood,24,16)
cube("Door inset",(tx+.10,.18,1.03),(.70,.06,.96),dark,.035)
cube("Glowing portal",(tx+.10,.12,1.12),(.48,.04,.92),door_glow,.025)

# Planks and crafted metal details.
for i in range(4):
    x=tx-.17+i*.18
    curve_line("Door plank seam",
               [(x,.19,.63),(x,.19,1.47)],.009,bark_dark)
for z in [.65,1.53]:
    cube("Door crossbar",(tx+.10,.12,z),(.66,.08,.065),gold,.018)
uv("Golden door handle",(tx+.36,.045,1.0),(.065,.035,.065),gold,12,8)

# Decorative runes on either side of the door.
for side in [-1,1]:
    for i in range(4):
        z=.85+i*.40
        uv("Glowing ancient rune",
           (tx+side*.78,.34,z),(.035,.025,.055),
           door_glow,10,8)

# ------------------ FERNS AND FOREST FLOOR ------------------

for i in range(34):
    x=random.uniform(-6.5,6.5)
    y=random.uniform(-5.5,3.4)
    if abs(x-tx)<1.3 and y>0:
        continue
    size=random.uniform(.18,.42)
    # Low rosettes with radiating, tapered leaves.
    for k in range(7):
        a=2*math.pi*k/7
        length=size*random.uniform(1.1,1.8)
        start=(x,y,.02)
        end=(x+math.cos(a)*length,
             y+math.sin(a)*length*.6,
             .04+length*.24)
        cylinder_between("Fern frond",start,end,
                         .035,.006,random.choice(fern_mats),6)

# Rocks with varied shape and mossy surface.
for i in range(36):
    x=random.uniform(-7,7)
    y=random.uniform(-5.8,2.5)
    size=random.uniform(.10,.32)
    o=ico("Natural mossy stone",(x,y,size*.34),
          (size*1.55,size,size*.72),stone_mat,2)
    o.rotation_euler[2]=random.uniform(0,math.tau)

# Small clusters of flowers.
for i in range(32):
    x=random.uniform(-6.5,6.5)
    y=random.uniform(-5.5,2.2)
    if random.random()<.55:
        continue
    cylinder_between("Wildflower stem",(x,y,.02),(x,y,.17),
                     .018,.009,fern_mats[0],6)
    uv("Wildflower bloom",(x,y,.19),(.065,.065,.035),
       random.choice(flower_mats),10,6)

# Mushrooms grouped in shaded patches.
for x,y,s in [(-5,-3,.7),(-4.4,-3.3,.5),(3.8,-2.7,.6),
              (4.3,-2.9,.4),(-1.7,1.5,.45)]:
    cylinder_between("Mushroom stem",(x,y,.02),(x,y,.20*s),
                     .055*s,.04*s,mat("Mushroom stem cream",(.8,.7,.49)),8)
    uv("Mushroom cap",(x,y,.22*s),(.22*s,.19*s,.12*s),
       flower_mats[1],12,8)

# ------------------ MAGICAL ATMOSPHERE ----------------------

emission=bpy.data.materials.new("Warm firefly glow")
emission.use_nodes=True
n=emission.node_tree.nodes
n.clear()
out=n.new("ShaderNodeOutputMaterial")
e=n.new("ShaderNodeEmission")
e.inputs["Color"].default_value=(1.0,.55,.16,1)
e.inputs["Strength"].default_value=2.2
emission.node_tree.links.new(e.outputs[0],out.inputs["Surface"])

for i in range(34):
    x=random.uniform(-6,6)
    y=random.uniform(-1,3)
    z=random.uniform(.8,5.7)
    uv("Tiny glowing firefly",(x,y,z),(.022,.022,.022),
       emission,8,6)

# Atmospheric depth is provided by layered trees and lighting; avoid a visible volumetric boundary.

# ---------------- CHARACTER INTEGRATION --------------------

img=bpy.data.images.load(str(CHARACTER),check_existing=True)
char_mat=bpy.data.materials.new("Character drawing with alpha")
char_mat.use_nodes=True
nodes=char_mat.node_tree.nodes
nodes.clear()
links=char_mat.node_tree.links
out=nodes.new("ShaderNodeOutputMaterial")
tex=nodes.new("ShaderNodeTexImage")
tex.image=img
bsdf=nodes.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Roughness"].default_value=.9
trans=nodes.new("ShaderNodeBsdfTransparent")
mix=nodes.new("ShaderNodeMixShader")
links.new(tex.outputs["Color"],bsdf.inputs["Base Color"])
links.new(tex.outputs["Alpha"],mix.inputs[0])
links.new(trans.outputs[0],mix.inputs[1])
links.new(bsdf.outputs[0],mix.inputs[2])
links.new(mix.outputs[0],out.inputs["Surface"])
char_mat.surface_render_method="DITHERED"

verts=[(-.85,0,0),(.85,0,0),(.85,0,1.9),(-.85,0,1.9)]
mesh=bpy.data.meshes.new("Character image plane")
mesh.from_pydata(verts,[],[(0,1,2,3)])
mesh.materials.append(char_mat)
hero=bpy.data.objects.new("Child-created story character",mesh)
scene.collection.objects.link(hero)
hero.location=(-.25,-2.1,.025)
uv=mesh.uv_layers.new(name="UVMap")
for face in mesh.polygons:
    for li in face.loop_indices:
        vi=mesh.loops[li].vertex_index
        uv.data[li].uv=[(0,0),(1,0),(1,1),(0,1)][vi]

# --------------------- CINEMATIC LIGHTS ---------------------

def area_light(name,loc,color,power,size,target):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=power
    data.color=color
    data.shape="DISK"
    data.size=size
    obj=bpy.data.objects.new(name,data)
    scene.collection.objects.link(obj)
    obj.location=loc
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    return obj

area_light("Golden sunlight through canopy",(-4,-2,9),
           (1.0,.68,.37),1100,5,(-2,1,2))
area_light("Cool forest bounce",(4,0,6),
           (.27,.60,.82),850,6,(0,1,2))
area_light("Warm character key",(-1,-5,4),
           (1.0,.79,.55),450,3,(-.2,-1,1))
area_light("Door magical glow",(-3,-.5,2),
           (1.0,.32,.08),120,1.4,(-3,1,1.4))

# World illumination
world=scene.world
world.use_nodes=True
world.node_tree.nodes["Background"].inputs["Color"].default_value=(.035,.075,.085,1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value=.35

# --------------------- CAMERA & RENDER ----------------------

bpy.ops.object.camera_add(location=(0,-16,6.1))
cam=bpy.context.object
cam.name="Enchanted forest cinematic camera"
target=Vector((-.2,.7,3.0))
cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.lens=42
cam.data.dof.use_dof=False
scene.camera=cam

scene.render.image_settings.color_mode="RGBA"
scene.render.resolution_percentage=100
scene.render.filepath=str(OUT)
scene.render.film_transparent=False
scene.render.use_file_extension=True
scene.render.image_settings.file_format="PNG"

# Save a reusable editable Blender project.
blendfile=ROOT/"backend/blender/enchanted_forest.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blendfile))
OUT.parent.mkdir(parents=True,exist_ok=True)
print("Rendering complete enchanted forest:",OUT)
bpy.ops.render.render(write_still=True)
print("Saved scene:",blendfile)
print("Saved render:",OUT)
