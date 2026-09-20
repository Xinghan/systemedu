"""检查网格和固件控制逻辑；不声称完成实体样机测试。"""
from pathlib import Path
import collections
import importlib.util
import struct
import sys
import types
ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'packages/student-web/public/project-lines/space-exploration/assemble-a-rover/hardware'
expected = {'deck-100x150x3': (100,150,3), 'strap-32x12x3': (32,12,3), 'fit-coupon': (60,16,3), 'bumper-84x12x16': (84,12,16)}
for name, dims in expected.items():
    raw = (ASSETS / (name+'.stl')).read_bytes()
    count = struct.unpack_from('<I', raw, 80)[0]
    assert len(raw) == 84 + count*50
    edges = collections.Counter()
    vertices = []
    volume = 0
    for i in range(count):
        values = struct.unpack_from('<12fH', raw, 84+i*50)
        v = [tuple(round(x,5) for x in values[3+j*3:6+j*3]) for j in range(3)]
        vertices += v
        a,b,c = v
        volume += (a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6
        for u,w in zip(v, v[1:]+v[:1]):
            edges[(u,w)] += 1
    assert all(n == 1 and edges[(w,u)] == 1 for (u,w),n in edges.items()), name+' 非闭合或重复面'
    actual = tuple(round(max(v[k] for v in vertices)-min(v[k] for v in vertices),3) for k in range(3))
    assert actual == dims, (name, actual, dims)
    assert volume > 0
    print(name, count, '面，闭合定向网格，体积', round(volume,2), 'mm³')

clock = {'ms':0,'contact_at':None,'exception':False}
class Pin:
    IN=0; OUT=1; PULL_UP=2
    pins={}
    def __init__(self, gpio, *args, **kwargs):
        self.gpio=gpio; self.level=0; Pin.pins[gpio]=self
    def value(self):
        return 1 if clock['contact_at'] is not None and clock['ms']>=clock['contact_at'] else self.level
class PWM:
    outputs=[]
    def __init__(self,pin): self.pin=pin; self.duty=0; self.max=0; PWM.outputs.append(self)
    def freq(self,n): pass
    def duty_u16(self,n): self.duty=n; self.max=max(n,self.max)
def sleep(n):
    clock['ms']+=n
    if clock['exception']: raise KeyboardInterrupt()
machine=types.ModuleType('machine'); machine.Pin=Pin; machine.PWM=PWM
fake_time=types.ModuleType('time'); fake_time.sleep_ms=sleep; fake_time.ticks_ms=lambda:clock['ms']; fake_time.ticks_diff=lambda a,b:a-b
sys.modules['machine']=machine; sys.modules['time']=fake_time
spec=importlib.util.spec_from_file_location('controller',ASSETS/'controller.py')
car=importlib.util.module_from_spec(spec); spec.loader.exec_module(car)
def idle(): assert not car.armed and all(p.duty==0 for p in PWM.outputs)
idle()
try: car.forward(); raise AssertionError('未 arm 即运行')
except RuntimeError: pass
idle()
Pin.pins[10].level=1
try: car.arm(); raise AssertionError('断线未阻止启动')
except RuntimeError: pass
Pin.pins[10].level=0
car.arm(); assert car.forward()=='time-stop'; idle()
car.arm(); clock['contact_at']=clock['ms']+20
assert car.forward(500)=='contact-stop'; idle()
clock['contact_at']=None; car.arm(); clock['exception']=True
try: car.turn(); raise AssertionError('应中断')
except KeyboardInterrupt: pass
idle(); clock['exception']=False
for duration in (0,-1,3001,3.2):
    car.arm()
    try: car.move(1,-1,duration); raise AssertionError('接受非法时间')
    except ValueError: pass
    idle()
car.arm(); car.move(1,-1,10); idle()
assert all(p.max<=int(.35*65535) for p in PWM.outputs)
print('固件：启动静止、触碰/断线、异常停止、时限、占空比检查通过。尚未实机验证。')
