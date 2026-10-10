"""Build a review-only M42 draft; do not replace the published source mapping."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = Path('/Users/xinghan/Dev/systemeduidea/projects_data/emg-prosthetic-hand/knodes/M42-w0-module')
original = json.loads((SOURCE / 'slides.json').read_text())
backup = HERE / 'M42-before-multimodal-v1.json'
if not backup.exists():
    backup.write_text(json.dumps(original, ensure_ascii=False, indent=2)+'\n')
scenes = ['overview','calibration','material','geometry','tradeoff','budget','rating','lab','decision','report','redesign','handoff']
titles = ['一个舵机带五指：先收集两类证据','位置标定不等于负载预算','看清实物：绳张力不是指尖接触力','转动模型：半径与垂直力臂','改变摇臂：扭矩与行程要一起看','五指预算：每一步都写出假设','读懂规格：堵转不是持续输出','动手实验：半径加倍，扭矩会怎样','选择结论：有数字，还要有正确的证据','本节产出：下载扭矩预算计算图','调整设计：收益与代价一起复核','下一阶段：用两份证据支撑整手联动']
scripts = [
    'M41 的标定回答手指能弯到哪里，M42 的预算回答舵机需要承受多大的负载。我们将用教学假设计算单指，再扩展到五指，最后列出规格中还缺少的证据。成果是可以下载的扭矩预算计算图。',
    '位置和力是两条不同的链。角度对应弯曲量不等于知道了拉力。改变摇臂之后，行程标定和负载预算都要复核。这里没有凭空补一张实测标定曲线，请使用上一节自己的记录。',
    '比较同一类绳驱手指的伸直和弯曲。橙色腱线在屈曲侧，蓝色回弹件在另一侧。指尖接触力与绳张力不是同一个量，不能直接相等。本节用 10 牛顿作为绳张力的教学假设，而不是声称每根真实手指都需要这个力。图片是生成的结构示意。',
    '拖动三维模型，俯视看拉力作用线，侧视看摇臂装配。力臂是转轴到力作用线的垂直距离。只有拉力垂直于半径时，力臂才等于半径。夹角变为零，作用线通过转轴，力矩也变为零。分解按钮只用于观察装配。',
    '张力与夹角不变时，半径一厘米增加到两厘米，需求力矩从 0.1 增到 0.2 牛米。短摇臂省扭矩，但行程可能不够。普通摇臂的绳位移取决于导向布置，所以改尺寸之后要重新标定。',
    '假设五根绳的张力都是 10 牛顿，都在一厘米有效半径处垂直拉动。单根是 0.1 牛米，五根求和是 0.5 牛米。本例乘 1.5 倍设计余量，得到 0.75 牛米。若选 2 倍，则为 1 牛米。真实手指不同，需要逐根求和，预算余量也不代替规格核验。',
    '说明书常见的扭矩单位应理解为千克力厘米。9 千克力厘米约为 0.883 牛米。但堵转是轴不转时的边界值，不代表可以长期持续输出。需要同时查连续扭矩、供电和温升工况，不能认为乘了余量就自动解决所有问题。',
    '实验固定一根绳、10 牛顿、垂直夹角，只改变半径。拖动滑块或点击播放，比较公式、力臂和扭矩柱如何一起变化。把一厘米和两厘米的读数记录到表格中。这是解析模型的计算结果，不是实物传感器测量；播放表示参数变化，不表示运行速度。',
    '需求 0.75 牛米小于示例的堵转值 0.883 牛米，能否断言放心使用？不能。这个比较只通过粗筛，缺少持续输出能力和真实负载数据时，正确结论是资料不足。选择有证据支撑的回答。',
    '用滑块改变半径和设计余量，观察整张预算表与结论同步更新。下载扭矩预算计算图，保留教学假设、每一步计算、堵转参考和待核验项。真实试验必须有成人指导，不要通过长时间堵转来验证力气。',
    '缩短摇臂可以减少同样张力下的扭矩需求，但要核对行程。改善绳道可能减少摩擦，但要用改善前后证据确认。差速或欠驱动改变负载分配，却不保证最坏负载一定变小，仍要重新检查工况。',
    '把 M41 的行程标定和 M42 的扭矩预算一起带到 M43。下一节设计整手联动时，先补齐实际张力和持续输出规格，改变结构后重新核验。今天的成果是一份可复核的计算与证据清单，而不是没有条件的安全保证。'
]
media = ['HTML evidence','HTML comparison','Generated raster + HTML','Three.js 3D + KaTeX','KaTeX + comparison','KaTeX + budget','KaTeX + specification','Analytic virtual experiment','Interactive judgement','HTML + PNG artifact','HTML engineering tradeoff','HTML evidence handoff']
result={'slides':[]}
for i,(old,scene,title,script) in enumerate(zip(original['slides'],scenes,titles,scripts)):
    payload={'technical_visual':{'renderer':'tendon-torque','scene':scene,'aria_label':title}}
    if scene=='material':
        payload['images']=[{'src':'images/finger-states-v1.webp','caption':'生成结构示意：左侧伸直、右侧弯曲；橙色屈曲腱线与蓝色回弹件位于两侧。非实测照片或加工图。'}]
        payload['visual_mode']='hybrid'
    result['slides'].append({'slide_id':old['slide_id'],'kind':old['kind'],'title':title,'audio_script':script,'audio_path':None,'payload':payload})
(HERE/'M42-multimodal-v1.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
image=SOURCE/'images/finger-states-v1.webp'
registry={'project':'emg-prosthetic-hand','node':'M42-w0-module','status':'local-review-only','version':'multimodal-v1','source_sha256':hashlib.sha256((SOURCE/'slides.json').read_bytes()).hexdigest(),'image':{'path':str(image),'bytes':image.stat().st_size,'sha256':hashlib.sha256(image.read_bytes()).hexdigest()},'slides':[{'id':s['slide_id'],'scene':scene,'method':medium,'title':s['title']} for s,scene,medium in zip(result['slides'],scenes,media)]}
(HERE/'M42-multimodal-v1.registry.json').write_text(json.dumps(registry,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'slides':len(result['slides']),'image_bytes':image.stat().st_size,'published_source_unchanged':True}))
