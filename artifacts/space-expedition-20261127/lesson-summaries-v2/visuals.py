"""Exact, time-driven teaching animation. All marks are authored geometry, not screenshots.

Constructed examples only: never presented as measured Kepler-10 data.
Each spoken sentence has its own visual state and an actual process transition.
"""
import math
import random
import subprocess
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W,H,FPS=1280,720,24
GOLD='#ffc878';BLUE='#82dbea';WHITE='#eef7fa';MUTED='#8faaba';PANEL='#102b40';GREEN='#9ed3b7'

@lru_cache(None)
def font(size):return ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc',size)
def ease(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
def lerp(a,b,p):return a+(b-a)*p

@lru_cache(None)
def background():
    im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
    for y in range(H):
        p=y/H;d.line((0,y,W,y),fill=(int(5+3*p),int(18+9*p),int(31+12*p)))
    rng=random.Random(27)
    for _ in range(130):
        x,y=rng.randrange(W),rng.randrange(H);r=rng.choice([1,1,2])
        d.ellipse((x-r,y-r,x+r,y+r),fill=rng.choice(['#14384b','#22465b','#38576a']))
    return im

class Canvas:
    def __init__(self):self.image=background().copy();self.d=ImageDraw.Draw(self.image)
    def text(self,x,y,text,size=28,color=WHITE):self.d.text((int(x),int(y)),text,font=font(size),fill=color)
    def box(self,box,fill=PANEL,outline=None,width=2,radius=18):self.d.rounded_rectangle(tuple(map(int,box)),radius=radius,fill=fill,outline=outline,width=width)
    def line(self,points,color=MUTED,width=2):self.d.line(points,fill=color,width=width)
    def dot(self,x,y,r=5,color=BLUE):self.d.ellipse((x-r,y-r,x+r,y+r),fill=color)
    def dash(self,a,b,color=MUTED,width=2):
        x1,y1=a;x2,y2=b;length=math.hypot(x2-x1,y2-y1)
        if not length:return
        for i in range(0,int(length),15):
            p=i/length;q=min((i+7)/length,1);self.line((lerp(x1,x2,p),lerp(y1,y2,p),lerp(x1,x2,q),lerp(y1,y2,q)),color,width)
    def arrow(self,a,b,color=GOLD,width=3):
        self.line((*a,*b),color,width);angle=math.atan2(b[1]-a[1],b[0]-a[0])
        self.d.polygon([b,(b[0]-14*math.cos(angle-.5),b[1]-14*math.sin(angle-.5)),(b[0]-14*math.cos(angle+.5),b[1]-14*math.sin(angle+.5))],fill=color)
    def star(self,x,y,r,t=0,dim=1):
        for rr in range(int(r*1.2),0,-3):
            p=max(0,min(1,rr/r));light=(1-p)*.4+.6
            if rr>r:color='#1e343e'
            else:color=(int(255*light*dim),int((174+60*(1-p))*dim),int((76+80*(1-p))*dim))
            self.d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=color)
        for i in range(13):
            angle=i*2.4+t*.12;rad=r*(.3+.045*i)
            xx=x+math.cos(angle)*rad;yy=y+math.sin(angle)*rad*.8
            self.d.arc((xx-6,yy-3,xx+6,yy+3),0,190,fill='#edac64',width=2)
    def telescope(self,x,y,scale=1):
        self.d.polygon([(x-110*scale,y-23*scale),(x-190*scale,y-55*scale),(x-195*scale,y+15*scale),(x-115*scale,y+43*scale)],fill='#345a75',outline=BLUE)
        self.d.polygon([(x+110*scale,y-23*scale),(x+190*scale,y-55*scale),(x+195*scale,y+15*scale),(x+115*scale,y+43*scale)],fill='#345a75',outline=BLUE)
        self.box((x-85*scale,y-50*scale,x+85*scale,y+50*scale),fill='#bacbd2',radius=15)
        self.d.ellipse((x-116*scale,y-50*scale,x-52*scale,y+50*scale),fill='#213b51',outline=BLUE,width=3)
        self.d.ellipse((x-103*scale,y-35*scale,x-65*scale,y+35*scale),fill='#0a1c2a')
        self.box((x+65*scale,y-36*scale,x+111*scale,y+36*scale),fill='#ba975b',radius=8)
    def header(self,ident,title):
        self.text(48,29,f'现场复盘 / {ident}',22,GOLD)
        self.text(48,75,title,39)
        self.text(922,32,'操作示范 · 构造数据',21,MUTED)
        self.line((48,134,1232,134),'#244153')
    def footer(self,item,timeline,t):
        progress=max(0,min(1,t/timeline['seconds']))
        self.line((48,650,1232,650),'#294455',3)
        self.line((48,650,48+1184*progress,650),GOLD,3)
        if t>=timeline['cues'][-1]['end']-.2:self.text(48,586,item['next'],28,GOLD)
        else:self.text(48,598,'示意数据与情境，不是 Kepler-10 实测记录',20,MUTED)
        self.text(48,674,'林岚 · 星际远航',18,MUTED)
        self.text(637,674,'Music: Firmament_Active · PeriTune · CC BY 4.0',18,MUTED)

VALUES=[100,100,100,99,97,96,97,99,100,100,100]
def plot(c,box=(105,209,1115,490),reveal=11,missing=(),highlight=None):
    left,top,right,bottom=box
    c.box((left-58,top-51,right+22,bottom+79),fill='#0b2030',radius=16)
    def xy(i,v):return left+35+i*(right-left-70)/10,top+35+(100-v)*(bottom-top-70)/4
    for v in [96,98,100]:
        y=xy(0,v)[1];c.line((left,y,right,y),'#244557');c.text(left-47,y-10,str(v),20,MUTED)
    c.line((left,top,left,bottom,right,bottom),MUTED,3)
    for i in range(11):
        x=xy(i,100)[0];c.line((x,bottom,x,bottom+6),MUTED)
        c.text(x-8,bottom+11,str(i),18,MUTED)
    c.text(left,top-37,'模拟亮度 / 任意单位',22,BLUE)
    c.text(right-124,bottom+43,'时间 / 秒',22,BLUE)
    pts=[]
    for i,v in enumerate(VALUES):
        x,y=xy(i,v);pts.append((x,y))
        if i<reveal and i not in missing:c.dot(x,y,6,GOLD if i==highlight else BLUE)
    return pts

def observation(c,stage,p,t):
    titles=['先描述看到的变化','同一种现象，可以有不同解释','把观察与解释分开记录']
    c.header('M01',titles[stage])
    if stage==0:
        reading=VALUES[min(10,int(p*11))]
        c.star(222,326,88,t,reading/100)
        c.text(132,451,'测量同一目标',25,MUTED)
        c.text(132,495,f'读数 {reading}',34,GOLD)
        c.arrow((348,327),(440,327))
        pts=plot(c,(510,225,1173,470),reveal=max(1,int(p*12)))
        if p>.63:c.text(630,525,'读数降低：先记下这个现象',26,GOLD)
    elif stage==1:
        labels=['遮挡？','恒星自身变化？','测量过程变化？']
        for i,name in enumerate(labels):
            x=224+i*410;c.box((x-170,181,x+170,516),outline='#355264')
            if i<2:
                c.star(x,306,65,t,1 if i==0 else .85+.15*math.sin(t*1.3))
                if i==0:c.dot(x-82+164*((t*.19)%1),306,18,'#071b2c')
                else:
                    xx=x+22*math.sin(t);c.d.ellipse((xx-15,285,xx+12,315),fill='#a5723d')
            else:
                c.box((x-83,237,x+83,375),fill='#1a3a50',outline=BLUE)
                for j in range(5):
                    y=265+j*19;c.line((x-53,y,x-53+105*(.6+.3*math.sin(t+j)),y),GOLD,5)
                c.dot(x+60,351,8,GREEN)
            c.text(x-142,424,name,28,GOLD)
        c.text(354,545,'可能原因需要证据，不能直接确认行星',26)
    else:
        c.box((55,190,590,536),outline=BLUE);c.box((630,190,1225,536),outline=GOLD)
        c.text(88,221,'观察到',32,BLUE);c.text(668,221,'可能解释 · 尚未确认',32,GOLD)
        c.text(88,302,'同一份记录里，',30);c.text(88,354,'有一段亮度读数降低。',30)
        options=['物体遮挡了部分星光？','恒星本身发生变化？','测量条件发生变化？']
        for i,text in enumerate(options):
            if p>(i*.22):c.text(668,301+i*64,text,27)

def instruments(c,stage,p,t):
    c.header('M02',['星光怎样变成记录','一次测量，留下对应的一行','读数据之前，先核对身份'][stage])
    if stage==0:
        c.star(166,320,65,t);c.text(83,442,'Kepler-10',28);c.text(119,485,'恒星',23,MUTED)
        c.telescope(648,320,.95);c.text(583,442,'Kepler',28);c.text(555,485,'空间望远镜',23,MUTED)
        c.arrow((272,320),(430,320));c.arrow((844,320),(949,320))
        for i in range(6):
            x=280+150*((t*.4+i/6)%1);c.dot(x,320+math.sin(i)*7,3,GOLD)
        for row in range(5):
            for col in range(5):
                color=GOLD if (row+col+int(t*3))%5==0 else '#285372'
                c.box((981+col*36,232+row*36,1007+col*36,258+row*36),fill=color,radius=5)
        c.text(1004,442,'探测器',28);c.text(978,485,'测量入射星光',23,MUTED)
    elif stage==1:
        c.box((66,185,470,541),outline='#395a70')
        c.text(98,213,'连续采样',30,GOLD)
        c.telescope(267,342,.65)
        c.dot(366,467,12,GOLD if int(t*3)%2 else '#284858')
        c.text(97,462,'每次亮起 → 一次测量',22)
        c.arrow((490,350),(554,350))
        c.box((588,185,1216,541),outline=BLUE)
        c.text(622,209,'示意记录 · 非实测',26,GOLD)
        c.text(625,262,'时间 / 秒',24);c.text(861,262,'模拟亮度 / 任意单位',24)
        c.line((615,304,1190,304),'#3d5c71')
        count=min(4,1+int(p*4))
        for i,(sec,value) in enumerate([(0,100),(1,100),(2,100),(3,99)]):
            if i<count:
                y=320+i*49
                if i==count-1:c.box((612,y-4,1192,y+36),fill='#284b5a',radius=6)
                c.text(680,y,str(sec),26,BLUE);c.text(959,y,str(value),26,GOLD)
    else:
        entries=[('目标','Kepler-10','我们观测的恒星'),('仪器','Kepler','记录星光的望远镜'),('来源','观测文件的出处','核对来源、时间和单位')]
        for i,(heading,name,note) in enumerate(entries):
            x=56+i*410;y=207+20*(1-ease(min(1,p*3-i*.35)))
            c.box((x,y,x+348,y+302),outline=GOLD if i==min(2,int(p*3)) else '#39576c')
            c.text(x+26,y+27,heading,27,GOLD);c.text(x+26,y+106,name,32)
            c.text(x+26,y+209,note,23,MUTED)
        c.text(239,552,'Kepler-10 是恒星；这里读取的是记录，不是星球照片',25)

def axes(c,stage,p,t):
    c.header('M03',['每个观测点都有两个坐标','沿着两条轴，读出同一个点','换一个缺测示例：留空，不补零'][stage])
    missing=(8,9) if stage==2 else ()
    pts=plot(c,(130,216,1146,471),reveal=max(1,int(p*12)) if stage==0 else 11,missing=missing,highlight=5 if stage==1 else None)
    x,y=pts[5]
    if stage==0:
        k=min(10,int(p*11));xx,yy=pts[k];c.dot(xx,yy,10,GOLD)
        c.text(153,549,f'时间 {k} 秒     模拟亮度 {VALUES[k]}',27,GOLD)
    elif stage==1:
        c.dash((x,471),(x,lerp(471,y,ease(p*2))),GOLD,3)
        if p>.35:c.dash((130,y),(lerp(130,x,ease((p-.35)*2)),y),GOLD,3)
        c.d.ellipse((x-15,y-15,x+15,y+15),outline=GOLD,width=3)
        c.box((824,351,1114,408),fill='#19394b',outline='#426275',radius=10)
        c.text(846,362,'(5 秒，96)',33,GOLD)
        c.text(151,549,'两个读数，描述同一次测量',27)
    else:
        xa,xb=pts[8][0]-21,pts[9][0]+21
        c.dash((xa,230),(xa,457),GOLD);c.dash((xb,230),(xb,457),GOLD)
        c.text(xa-18,174,'这里缺测',25,GOLD)
        c.text(157,549,'没有观测点 ≠ 亮度为零',30,GOLD)
        cursor=lerp(7.1,9.9,p);cx=pts[0][0]+cursor*(pts[1][0]-pts[0][0])
        c.dash((cx,228),(cx,469),BLUE)
        if round(cursor) in missing:
            c.box((832,349,1122,407),fill='#17374a',outline=GOLD,radius=10)
            c.text(851,363,'读数：无记录',29,GOLD)

def window(c,stage,p,t):
    c.header('M04',['只看最低点，还缺少上下文','向两边展开，保留前后参照','把区间边界与理由一起记下'][stage])
    box=(105,213,855 if stage==2 else 1160,473)
    pts=plot(c,box)
    span=lerp(3,.2,ease(p)) if stage==0 else (lerp(.2,3,ease(p)) if stage==1 else 3)
    dx=pts[1][0]-pts[0][0];center=pts[5][0]
    left,right=center-span*dx,center+span*dx
    c.box((left,215,right,471),fill=None,outline=GOLD,width=5,radius=6)
    for x in [left,right]:c.box((x-7,320,x+7,370),fill=GOLD,radius=4)
    if stage==0:
        c.text(264,548,'最低点被圈住了，但变化前后发生了什么？',29,GOLD)
    elif stage==1:
        if p>.6:
            c.text(left-30,171,'变化前',24,GOLD);c.text(right-28,171,'变化后',24,GOLD)
        c.text(283,548,'让下降、下降之前和之后都留在视野里',29)
    else:
        c.box((910,190,1222,538),outline='#3b5a70')
        c.text(935,217,'候选区间',29,GOLD)
        c.text(936,282,'2–8 秒',37)
        if p>.2:c.text(935,359,'选择理由',24,BLUE)
        if p>.4:c.text(935,404,'覆盖下降及',27);c.text(935,448,'前后参照记录',27)
        c.text(151,549,'候选 ≠ 结论；保留可复查的选择依据',28,GOLD)

def mini_chart(c,x,y,w=215,h=68):
    c.line((x,y,x,y+h,x+w,y+h),'#638699',2)
    for i,v in enumerate(VALUES):c.dot(x+12+i*(w-24)/10,y+12+(100-v)*(h-20)/4,3,BLUE)

def dossier(c,stage,p,t):
    c.header('M05',['把四份材料收进同一张观察卡','观察与解释，分别填写','把尚未查清的留给下一步'][stage])
    if stage==0:
        c.box((726,180,1220,549),fill='#17364a',outline=GOLD)
        c.text(758,205,'第一份观测记录',33,GOLD)
        labels=['研究问题','数据来源','标注图','候选区间']
        notes=['想调查什么变化？','记录从哪里来？','标出时间与亮度轴','写明边界和理由']
        for i,label in enumerate(labels):
            amount=ease((p-i*.20)*4)
            xx=lerp(65+(i%2)*315,756,amount);yy=lerp(190+(i//2)*179,271+i*61,amount)
            ww=lerp(283,428,amount);hh=lerp(151,52,amount)
            c.box((xx,yy,xx+ww,yy+hh),fill='#24485c',outline=BLUE if i==2 else '#7799a5',radius=12)
            c.text(xx+18,yy+13,label,26,GOLD)
            if amount<.3:
                if i==2:mini_chart(c,xx+24,yy+57,225,65)
                else:c.text(xx+18,yy+75,notes[i],21)
        c.text(162,559,'材料之间能够互相对应，别只留下一个结论',27)
    else:
        c.box((61,177,1219,549),fill='#102b40',outline='#477086')
        c.text(88,201,'观察卡 · 填写示范',25,GOLD)
        for i,(title,color) in enumerate([('观察',BLUE),('可能解释',GOLD),('待检查',GREEN)]):
            x=89+i*379;c.text(x,264,title,29,color)
            c.line((x,310,x+340,310),color,2)
        c.text(89,339,'记录中有一段',28);c.text(89,387,'亮度读数降低。',28)
        if stage==2 or p>.25:
            c.text(468,339,'可能存在遮挡，',28);c.text(468,387,'但还需要检验。',28)
        if stage==2:
            for i,text in enumerate(['核对数据来源','检查缺测与异常','比较其他解释']):
                if p>i*.22:
                    c.box((848,340+i*55,865,357+i*55),fill=None,outline=GREEN,radius=3)
                    c.text(882,332+i*55,text,25)
        else:c.text(849,345,'还没有查清的，',26,MUTED);c.text(849,390,'留给下一步。',26,MUTED)

def frame(ident,item,timeline,t):
    c=Canvas();cues=[cue for cue in timeline['cues'] if cue['section']=='demo']
    stage=next((i for i,cue in enumerate(cues) if t<cue['end']+.35),len(cues)-1)
    cue=cues[stage];p=max(0,min(1,(t-cue['start'])/(cue['end']-cue['start'])))
    {'M01':observation,'M02':instruments,'M03':axes,'M04':window,'M05':dossier}[ident](c,stage,p,t)
    c.footer(item,timeline,t)
    return c.image

def precision_insert(ident,p,t):
    """Replace the generated display close-up: AI glyphs must not teach numbers/axes."""
    c=Canvas()
    titles={'M01':'测量过程，也需要检查','M02':'探测器：把光变成测量记录','M03':'一行测量，对应一个观测点','M04':'把下降前后的记录一起保留','M05':'四份材料，组成可复查的记录'}
    c.header(ident,titles[ident])
    if ident in ['M01','M02']:
        c.box((60,178,680,551),outline=BLUE)
        c.text(89,201,'探测器阵列 · 示意',27,BLUE)
        for row in range(6):
            for col in range(11):
                x=103+col*47;y=260+row*41
                brightness=math.exp(-((col-5)**2+(row-2.5)**2)/5)
                active=brightness*(.82+.12*math.sin(t*4+row*.2))
                color=(int(31+212*active),int(64+133*active),int(81+25*active))
                c.box((x,y,x+34,y+30),fill=color,radius=4)
        c.arrow((703,360),(785,360))
        c.box((818,178,1220,551),outline=GOLD)
        if ident=='M01':
            c.text(851,207,'检查测量条件',29,GOLD)
            for i,text in enumerate(['仪器状态','背景影响','校准情况']):
                c.text(870,294+i*71,text,29)
                c.dot(843,309+i*71,5,BLUE if i<=int(p*3) else '#304958')
            c.text(146,579,'测量过程变化，也可能影响读数',30,GOLD)
        else:
            c.text(852,207,'示意记录',29,GOLD)
            c.text(850,265,'时间 / 秒      亮度',23)
            for i in range(min(4,1+int(p*4))):
                c.text(884,313+i*49,str(i),29,BLUE);c.text(1088,313+i*49,str(VALUES[i]),29,GOLD)
            c.text(215,579,'逐次测量 → 按时间排列的记录',30,GOLD)
    elif ident=='M03':
        c.box((53,190,386,534),outline=BLUE)
        c.text(83,221,'一行示意记录',29,GOLD)
        c.text(85,303,'时间     亮度',25)
        c.box((77,357,361,427),fill='#285066',radius=9)
        c.text(98,371,'5 秒     96',33)
        c.arrow((405,371),(465,371))
        points=plot(c,(535,225,1185,464),highlight=5)
        x,y=points[5];c.d.ellipse((x-15,y-15,x+15,y+15),outline=GOLD,width=3)
        c.dash((x,464),(x,y),GOLD);c.dash((535,y),(x,y),GOLD)
        c.text(295,579,'每个点，都保留时间与亮度的对应关系',28,GOLD)
    elif ident=='M04':
        pts=plot(c,(115,213,1165,480))
        span=lerp(.35,3,ease(p));dx=pts[1][0]-pts[0][0];cx=pts[5][0]
        left,right=cx-span*dx,cx+span*dx
        c.box((left,214,right,479),fill=None,outline=GOLD,width=3,radius=9)
        for x in [left,right]:c.box((x-7,323,x+7,373),fill=GOLD,radius=4)
        c.text(215,579,'从最低点向两侧展开，留下完整的变化过程',28,GOLD)
    else:
        for i,(title,sub) in enumerate([('问题','想调查什么变化'),('来源','观测文件的出处'),('标注图','时间、亮度与单位'),('候选区间','边界及选择理由')]):
            x=59+i*307;y=225-25*math.sin(min(1,max(0,p*2-i*.23))*math.pi)
            c.box((x,y,x+270,y+286),outline=GOLD if i<=int(p*4) else '#46687a')
            c.text(x+24,y+28,title,32,GOLD)
            if i==2:mini_chart(c,x+25,y+96,220,82)
            else:
                for j in range(3):c.line((x+28,y+110+j*23,x+230-j*18,y+110+j*23),'#466a7e',3)
            c.text(x+23,y+220,sub,23)
        c.text(270,579,'先把材料对应起来，再进入作品页核对',28,GOLD)
    c.text(48,674,'构造示例 · 非实测数据 · 不代表学生已提交',20,MUTED)
    return c.image

def render_insert(ident,duration,target):
    _encode((precision_insert(ident,i/max(1,math.ceil(duration*FPS)-1),i/FPS) for i in range(math.ceil(duration*FPS))),target)

def render(ident,item,timeline,target):
    duration=timeline['seconds']-15;count=math.ceil(duration*FPS)
    _encode((frame(ident,item,timeline,15+i/FPS) for i in range(count)),target)

def _encode(frames,target):
    cmd=['ffmpeg','-nostdin','-y','-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','-','-an','-c:v','libx264','-preset','fast','-crf','20','-pix_fmt','yuv420p','-threads','2',str(target)]
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for image in frames:process.stdin.write(image.tobytes())
        process.stdin.close();error=process.stderr.read();code=process.wait()
        if code:raise RuntimeError(error.decode()[-1500:])
    except BaseException:
        process.kill();process.wait();raise

if __name__=='__main__':
    import json
    here=Path(__file__).resolve().parent
    story=json.loads((here/'storyboards.json').read_text())
    for ident,item in story.items():
        timeline=json.loads((here/ident/'timeline.json').read_text())
        for i,cue in enumerate([q for q in timeline['cues'] if q['section']=='demo']):
            frame(ident,item,timeline,(cue['start']+cue['end'])/2).save(here/ident/f'demo-preview-{i+1}.png')
