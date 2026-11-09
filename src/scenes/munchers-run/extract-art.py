from PIL import Image, ImageSequence
import json, math
S="/private/tmp/claude-501/-Users-gmiller--dotfiles-claude-machines-personal/43d843fd-e845-457a-b1df-95fe4a2c1a8b/scratchpad"
NM="/Users/gmiller/projects/number-munchers/public/sprites/"
man=json.load(open(NM+"sprites.json"))

def hexrgb(h): return tuple(int(h[i:i+2],16) for i in (1,3,5))
# curated palettes: letter -> (hex, accent?)   accent colours win a block at >=30% share
PAL={
 "reggie":  {"K":("#2B1B1E",0),"P":("#F0A0D0",0),"Q":("#C870A8",0),"T":("#F8E0B0",0),"U":("#C8A878",0)},
 "ember":   {"K":("#2B2B2B",0),"R":("#D8402A",0),"Y":("#F0B040",0),"O":("#FF8A30",1)},
 "bonehead":{"K":("#3D253B",1),"W":("#E9CEC3",0),"S":("#CCA9A4",0)},
 "fangs":   {"K":("#4E3458",0),"R":("#C54C67",0),"D":("#923C5E",0)},
 "squirt":  {"K":("#1A1F4A",0),"B":("#4A7AB0",0),"L":("#5CB0C0",0),"W":("#FFFFFF",1),"R":("#D83040",1)},
 "chicken": {"W":("#FFFFFF",0),"S":("#D0C8C8",0),"K":("#4A3040",0),"R":("#D83A3A",1),"O":("#F0A030",1)},
}

def nearest(c,pal):
    return min(pal,key=lambda k:sum((a-b)**2 for a,b in zip(c,hexrgb(pal[k][0]))))

def shrink_blocks(frames, target_h, pal, flip=False, name_hint=""):
    boxes=[f.getbbox() for f in frames]
    l=min(b[0] for b in boxes); t=min(b[1] for b in boxes); r=max(b[2] for b in boxes); b_=max(b[3] for b in boxes)
    scale=target_h/(b_-t); w=max(1,round((r-l)*scale))
    out=[]
    for f in frames:
        c=f.crop((l,t,r,b_))
        if flip: c=c.transpose(Image.FLIP_LEFT_RIGHT)
        px=c.load(); rows=[]
        for ty in range(target_h):
            y0=int(ty*c.height/target_h); y1=max(y0+1,int((ty+1)*c.height/target_h))
            row=""
            for tx in range(w):
                x0=int(tx*c.width/w); x1=max(x0+1,int((tx+1)*c.width/w))
                counts={}; n=0; opaque=0
                for y in range(y0,y1):
                    for x in range(x0,x1):
                        n+=1
                        p=px[x,y]
                        if p[3]<128: continue
                        opaque+=1
                        k=nearest(p[:3],pal); counts[k]=counts.get(k,0)+1
                if opaque*2<n: row+="."; continue
                acc=[k for k in counts if pal[k][1] and counts[k]>=(0.15 if name_hint=="squirt" else 0.3)*opaque]
                row+= acc[0] if acc else max(counts,key=counts.get)
            rows.append(row)
        out.append(rows)
    return out

def character(name, target_h):
    e=man[name]; im=Image.open(NM+e["sheet"]).convert("RGBA"); fw,fh=e["frameWidth"],e["frameHeight"]; cols=im.width//fw
    a=e["animations"]["walkRight"]; idxs=list(range(a["frames"][0],a["frames"][1]+1))
    frames=[im.crop(((i%cols)*fw,(i//cols)*fh,(i%cols)*fw+fw,(i//cols)*fh+fh)) for i in idxs]
    return shrink_blocks(frames,target_h,PAL[name],flip=bool(a.get("flipX")),name_hint=name)

def chicken(target_h):
    g=Image.open(S+"/chicken-gif/chicken.gif")
    frames=[f.convert("RGBA") for f in ImageSequence.Iterator(g)]
    bg=(153,174,60); cut=[]
    for f in frames:
        f=f.crop((0,0,f.width,int(f.height*0.78))); px=f.load()
        for y in range(f.height):
            for x in range(f.width):
                r,g_,b,a=px[x,y]
                if abs(r-bg[0])+abs(g_-bg[1])+abs(b-bg[2])<90: px[x,y]=(0,0,0,0)
        cut.append(f)
    return shrink_blocks(cut,target_h,PAL["chicken"])

def preview(result):
    scale=10; gap=4
    total_w=sum((len(fr[0])*scale+gap)*len(d["frames"]) for d in result.values() for fr in [d["frames"][0]])
    H=max(len(d["frames"][0]) for d in result.values())*scale
    img=Image.new("RGB",(total_w,H),(30,30,30)); x=0
    for name,d in result.items():
        for fr in d["frames"]:
            for y,row in enumerate(fr):
                for xx,ch in enumerate(row):
                    if ch==".": continue
                    col=hexrgb(d["colors"][ch])
                    for dy in range(scale):
                        for dx in range(scale): img.putpixel((x+xx*scale+dx,y*scale+dy),col)
            x+=len(fr[0])*scale+gap
    img.save("preview.png")

if __name__=="__main__":
    spec={"reggie":11,"ember":10,"bonehead":11,"fangs":9,"squirt":9}
    result={}
    for name,h in spec.items():
        result[name]={"frames":character(name,h),"colors":{k:v[0] for k,v in PAL[name].items()}}
    ch=chicken(11); result["chicken"]={"frames":ch[::2],"colors":{k:v[0] for k,v in PAL["chicken"].items()}}
    json.dump(result,open("sprites.json","w"),indent=1)
    preview(result)
    for name,d in result.items():
        print("==",name,"frames",len(d["frames"]),"size",len(d["frames"][0][0]),"x",len(d["frames"][0]))
        for r in d["frames"][0]: print("  ",r)
