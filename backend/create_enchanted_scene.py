from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path
import random, math

random.seed(81)
ROOT = Path(__file__).parent
CHAR = ROOT / "test-assets" / "elephant-cutout.png"
OUT = ROOT / "public" / "scenes" / "enchanted-tree-prototype.png"
W, H, S = 1280, 720, 2
w, h = W*S, H*S

def xy(points):
    return [(int(x*S), int(y*S)) for x,y in points]

def layer():
    return Image.new("RGBA", (w,h), (0,0,0,0))

def poly(im, points, color):
    ImageDraw.Draw(im).polygon(xy(points), fill=color)

def oval(im, box, color):
    ImageDraw.Draw(im).ellipse(tuple(int(v*S) for v in box), fill=color)

def roundrect(im, box, radius, color):
    ImageDraw.Draw(im).rounded_rectangle(
        tuple(int(v*S) for v in box), radius=radius*S, fill=color)

def composite_paper(canvas, piece, blur=7, offset=(4,6), opacity=.36):
    a = piece.getchannel("A").filter(ImageFilter.GaussianBlur(blur*S))
    sh = Image.new("RGBA", piece.size, (15,25,23,0))
    sh.putalpha(a.point(lambda v: int(v*opacity)))
    canvas.alpha_composite(sh, (offset[0]*S, offset[1]*S))
    canvas.alpha_composite(piece)

# Atmospheric dusk sky with a warm glow behind the ancient tree.
im = Image.new("RGBA", (w,h))
p = im.load()
for y in range(h):
    t = y/(h-1)
    for x in range(w):
        xx, yy = x/S, y/S
        glow = max(0, 1-math.sqrt(((xx-820)/620)**2+((yy-350)/470)**2))
        p[x,y] = (
            int(18*(1-t)+58*t+glow*95),
            int(38*(1-t)+68*t+glow*56),
            int(55*(1-t)+72*t+glow*24), 255)

# Faraway hills and a waterfall glimpsed through the trees.
for points, color in [
    ([(-40,425),(130,350),(290,414),(465,335),(620,410),
      (820,340),(1030,405),(1320,330),(1320,580),(-40,580)],
     (54,105,105,255)),
    ([(-40,485),(175,408),(360,465),(555,397),(750,462),
      (980,390),(1320,455),(1320,610),(-40,610)],
     (34,79,83,255))]:
    q=layer(); poly(q,points,color); composite_paper(im,q,8,(2,5))

water=layer()
poly(water,[(245,370),(279,373),(298,442),(320,484),
            (299,535),(279,485),(265,430)],(133,202,204,205))
poly(water,[(282,416),(292,453),(309,478),(293,500)],
     (215,238,218,210))
composite_paper(im,water,3,(1,2),.2)

# Tiny floating fireflies establish a magical atmosphere.
for _ in range(38):
    x=random.randint(35,1240); y=random.randint(140,615)
    r=random.choice([1.5,2,2.5,3])
    glow=layer()
    oval(glow,(x-12,y-12,x+12,y+12),(255,184,67,24))
    oval(glow,(x-r*2,y-r*2,x+r*2,y+r*2),(255,204,100,110))
    oval(glow,(x-r,y-r,x+r,y+r),(255,241,185,255))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(4*S)))
    im.alpha_composite(glow)

# A broad, curved ancient tree trunk: overlapping irregular bark plates.
trunk=layer()
poly(trunk,[(-60,720),(-35,410),(50,330),(112,250),
            (180,205),(270,226),(340,286),(385,380),
            (420,720)],(93,54,39,255))
composite_paper(im,trunk,12,(7,9))

bark=layer()
poly(bark,[(12,720),(30,432),(94,353),(142,273),(175,245),
           (193,315),(154,391),(145,520),(173,720)],
     (122,75,48,255))
poly(bark,[(226,720),(218,512),(270,405),(292,323),(270,259),
           (319,303),(347,394),(322,520),(355,720)],
     (67,55,42,255))
poly(bark,[(58,720),(83,533),(116,466),(125,397),(158,355),
           (149,474),(113,558),(126,720)],
     (155,95,55,255))
composite_paper(im,bark,3,(2,3),.2)

# Organic, overlapping leaf clusters arch across the top.
for cx,cy,rx,ry in [
    (30,105,150,118),(175,85,150,110),(330,125,135,100),
    (510,50,150,105),(685,45,135,90),(880,70,145,110),
    (1050,70,165,125),(1220,130,150,130)]:
    foliage=layer()
    for i in range(29):
        a=random.random()*math.tau
        radius=math.sqrt(random.random())
        x=cx+math.cos(a)*rx*radius
        y=cy+math.sin(a)*ry*radius
        ww=random.randint(25,62); hh=random.randint(15,35)
        col=random.choice([
            (22,67,56,255),(31,85,61,255),(43,104,67,255),
            (61,119,70,255),(81,132,75,255),(119,143,79,255)])
        poly(foliage,[(x-ww,y),(x-ww*.4,y-hh),(x+ww*.55,y-hh*.7),
                      (x+ww,y+2),(x+ww*.2,y+hh),(x-ww*.65,y+hh*.35)],col)
    composite_paper(im,foliage,5,(3,4),.24)

# Warm inner glow around a tiny arched door in the ancient tree.
halo=layer()
oval(halo,(105,280,360,570),(255,157,47,35))
oval(halo,(135,315,330,540),(255,177,68,48))
im.alpha_composite(halo.filter(ImageFilter.GaussianBlur(24*S)))

door=layer()
# Recess and outer carved arch.
roundrect(door,(150,342,315,538),18,(45,34,31,255))
oval(door,(150,315,315,430),(45,34,31,255))
roundrect(door,(163,350,302,530),12,(175,108,54,255))
oval(door,(163,325,302,408),(175,108,54,255))
roundrect(door,(175,365,290,525),8,(82,49,35,255))
oval(door,(175,340,290,410),(82,49,35,255))
roundrect(door,(183,372,282,523),5,(132,78,42,255))
oval(door,(183,350,282,407),(132,78,42,255))
# Wooden planks and little brass handle.
d=ImageDraw.Draw(door,"RGBA")
for x in [205,230,255]:
    d.line((x*S,390*S,x*S,516*S), fill=(70,43,32,180), width=2*S)
oval(door,(263,442,276,455),(255,209,103,255))
composite_paper(im,door,5,(4,6))

# Doorstep and winding trail, guiding the viewer toward the discovery.
path=layer()
poly(path,[(270,720),(610,720),(500,630),(385,575),
           (310,536),(272,555),(324,602),(395,651)],
     (157,111,73,255))
poly(path,[(320,720),(550,720),(465,646),(372,600)],
     (199,150,94,255))
poly(path,[(138,541),(300,541),(326,564),(124,564)],
     (193,139,78,255))
composite_paper(im,path,5,(3,5))

# Moss, mushrooms and little leaves in the foreground.
ground=layer()
poly(ground,[(-20,650),(130,608),(290,649),(450,610),
             (610,659),(800,615),(1030,655),(1300,605),
             (1320,760),(-20,760)],(27,67,55,255))
composite_paper(im,ground,6,(2,4))
details=layer()
for _ in range(145):
    x=random.randint(0,1279); y=random.randint(610,735)
    size=random.randint(3,9)
    col=random.choice([(105,140,74,255),(151,157,81,255),
                       (209,158,87,255),(221,127,111,255)])
    poly(details,[(x-size,y),(x,y-size*.8),(x+size,y),(x,y+size)],col)

for x,y,s in [(430,625,1),(770,650,.8),(1000,610,.7)]:
    oval(details,(x-14*s,y,x+14*s,y+12*s),(201,120,86,255))
    oval(details,(x-19*s,y-17*s,x+19*s,y+5*s),(211,83,72,255))
    for dx in [-9,2,10]:
        oval(details,(x+dx*s-2,y-10*s,x+dx*s+2,y-6*s),
             (255,221,167,255))
composite_paper(im,details,2,(1,2),.2)

# Foreground leaves frame the scene like a miniature theatre.
frame=layer()
for side in [0,1280]:
    direction=1 if side==0 else -1
    for i in range(8):
        x=side+direction*(i*12)
        y=500+i*31
        poly(frame,[(x,y),(x+direction*100,y-42),
                    (x+direction*70,y+5),(x+direction*115,y+27),
                    (x+direction*22,y+35)],
             random.choice([(18,54,45,255),(28,73,51,255),
                            (40,87,55,255)]))
composite_paper(im,frame,5,(3,4))

# Integrate the child's elephant with a soft contact shadow.
if not CHAR.exists():
    raise SystemExit(f"Missing character: {CHAR}")
hero=Image.open(CHAR).convert("RGBA")
bbox=hero.getchannel("A").getbbox()
if not bbox:
    raise SystemExit("Character has no visible pixels.")
hero=hero.crop(bbox)
target=300*S
scale=target/hero.height
hero=hero.resize((int(hero.width*scale),target),Image.Resampling.LANCZOS)

# Ground shadow, plus a subtle warm bounce light under the character.
shadow=Image.new("RGBA",hero.size,(20,28,22,0))
shadow.putalpha(hero.getchannel("A").filter(
    ImageFilter.GaussianBlur(13*S)).point(lambda v:int(v*.29)))
hx,hy=420*S,690*S-hero.height
im.alpha_composite(shadow,(hx+9*S,hy+13*S))
im.alpha_composite(hero,(hx,hy))

# Gentle vignette and downsample for clean 720p output.
im=im.convert("RGB").resize((W,H),Image.Resampling.LANCZOS)
v=Image.new("L",(W,H),0); vp=v.load()
for y in range(H):
    for x in range(W):
        r=math.sqrt(((x-W/2)/(W*.76))**2+((y-H/2)/(H*.82))**2)
        vp[x,y]=int(max(0,min(105,(r-.42)*125)))
shade=Image.new("RGB",(W,H),(10,20,24))
im=Image.composite(shade,im,v.filter(ImageFilter.GaussianBlur(20)))
OUT.parent.mkdir(parents=True,exist_ok=True)
im.save(OUT,quality=96)
print(f"Created: {OUT}")
print(f"Resolution: {W}x{H}")
