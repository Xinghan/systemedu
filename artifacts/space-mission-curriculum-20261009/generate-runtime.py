"""Derive stable source references from the approved audit, without copying lessons."""
import json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
plan=json.loads((root.parent/'systemeduidea/project_lines/space-exploration/mission-resequence-20261009/curriculum-map.json').read_text())
ids=['first-contact','mission-design','mechanics','build','perception','autonomy','expedition','delivery']
acts=[1,2,2,3,4,4,5,5]
films=[1,2,2,3,None,None,4,None]
inputs=[
 '不需要器材。任选一个体验，带回一次操作或观察。',
 '你的观察问题。轨道选址用于研究问题，本地测试场地需要另行确认。',
 '任务简报与装备取舍。模拟尺寸和预算需要在制造时重新测量。',
 '底盘与接口方案。先完成数字原型，再打印、接线和低速测试。',
 '任务中要分辨的地形与图像来源。等待打印时也可以先到这里。',
 '同一辆打印车、导出模型和误差报告。先核对升级架构，再联调。',
 '已测试的车辆版本与明确的任务边界。人工演练和自主实测分开记录。',
 '之前各站的作品与原始日志。复用已有资料，补齐版本和结论。',
]
gates=[
 '任选一次体验，带回一次观察，就可以出发。不必把三个体验全部做完。',
 '说明为什么这样选，并留下尚未验证的问题。先完成简报，再逐步实现它。',
 '做一次同条件比较，记录选择和理由。模拟参数只是设计线索，真实尺寸和质量需要实测。',
 '交付自己的 CAD、程序、试配与实测记录。车要能前进、转向和触碰停止；数字原型不能替代实物。',
 '保留训练数据、模型和独立测试结果。理解像素、卷积与误判，不为达到某个准确率而修改真实结果。',
 '硬件升级与目标、路线闭环须经实机验证。分类调速不等于导航；目标不明、输入超时或断连时，要能可靠停止。',
 '带着同一辆车和同一个目标，完成计划、检查、试跑、分析与复测。保留第一次失败；人工演练和自主实测分开记录。',
 '对照任务标准，交付可复查的代码、数据与结论。说明模型的能力边界；公开分享由你决定。',
]
# Supporting lessons are resources inside one task, not another round of submission.
anchor={
 'mars-analog-rover:M01':'micro',
 'mars-analog-rover:M24':'assemble-a-rover:M06',
 'mars-analog-rover:M34':'assemble-a-rover:M08',
 'mars-analog-rover:M10':'mars-analog-rover:M08',
 'mars-analog-rover:M23':'mars-analog-rover:M22',
 'mars-analog-rover:M23b':'mars-analog-rover:M22',
 'mars-analog-rover:M36b':'mars-analog-rover:M36',
 'mars-analog-rover:M37':'run-an-expedition:M03',
 'mars-analog-rover:M38':'run-an-expedition:M01',
 'mars-analog-rover:M39':'run-an-expedition:M04',
 'mars-analog-rover:M40':'run-an-expedition:M04',
 'mars-analog-rover:M41':'run-an-expedition:M04',
 'mars-analog-rover:M42':'run-an-expedition:M04',
 'mars-analog-rover:M43':'run-an-expedition:M05',
 'mars-analog-rover:M44':'run-an-expedition:M05',
 'mars-analog-rover:M45':'run-an-expedition:M05',
 'mars-analog-rover:M46':'run-an-expedition:M02',
 'mars-analog-rover:M47':'run-an-expedition:M05',
}
optional={'mars-analog-rover:'+m for m in ['M01','M09','M27','M31','M52','M54']}
notices={
 'M11':'先认识变量、调用与输出，再把同样的思考用于车载程序。Colab Python 和 Pico MicroPython 的运行位置不同。',
 'M24':'这节来自旧金属底盘方案。本任务使用你已有的打印车，制造操作已由打印试配节点承接；不要照旧清单另买底盘。',
 'M34':'只借用固定、防护与检查思路。当前打印车没有防水认证，不做浸水或跌落试验。',
 'M10':'用当前数据卡做一次复查即可，不重复发布或再交一份相同总结。',
 'M15':'如实报告留出集结果与失败，不把 80% 当作必须凑出的数字。',
 'M20':'地面视角与轨道影像不同，记录相机、距离和可观察类别；不按相似名称直接转换标签。',
 'M21':'迁移失败也是有效研究结果。需要地面重训时保留原模型和对照数据。',
 'M22':'未经校准的 0.8 分数不保证八成正确。用独立样本检验阈值和未知输入。',
 'M23':'复用已有误差报告和模型版本；本材料作为一次复查，不重交同一总结。',
 'M23b':'模型交付材料汇入同一个任务档案。先检查导出模型和测试结果，再进行装车联调。',
 'M25':'旧例程使用 Pi 直接驱动电机；本任务计划保留 Pico 控制，通讯与供电尚需样机验证。可学习原理，不能直接照旧接线。',
 'M28':'若未选 GPS 扩展，日志使用声明清楚的本地检查点与时间，不伪造经纬度。',
 'M32':'控制循环只是基础；还需目标信号、路线执行、到点判定和超时停止。当前桥接未完成样机验证。',
 'M33':'按地形调速不等于会找路。路线闭环需单独检验，不能用分类准确率作为到达目标的证据。',
 'M35':'先核对接线、供电、通讯和停止测试。课程旧车型试跑步骤不能直接当成打印车已验证的流程。',
 'M36b':'复用同一辆车的联调档案；整车提交不等于已经通过新版自主任务验收。',
 'M47':'输出稳定不代表模型理解了场景。保留实际错误和未验证条件。',
 'M48':'汇集已有文件与原始记录，补版本关系。不要为交付重新制造一套数据。',
}
guided_notices={
 'pick-an-observation-site:M03':'把轨道影像的观察问题带到任务简报。现场远征仍需重新选择本地场地，不把轨道坐标直接当作车的行驶目标。',
 'plan-a-payload:M03':'这里的千克预算是任务取舍练习。实物车要用克、实测尺寸与实际供电重新核对，不能直接复制数值。',
 'tune-a-chassis:M03':'后续组装读取轮子与速度选择；离地间隙目前作为设计参考，不会自动变成打印尺寸。制造时请重新试配和测量。',
 'label-the-terrain:M03':'这一站的两类近邻练习提供标注经验，不等于五类图像模型。接下来保留像素、卷积、训练和独立测试的完整学习。',
 'write-driving-rules:M04':'带走经过比较的规则思路。实物起步车使用触碰开关，尚不会自动读取这些视觉规则；要在程序节点重新适配并测试。',
}
modules=[]
for a in plan['allocation']:
 ref=a['ref']; mode='optional' if ref in optional else 'replaced' if a['module_id']=='M24' and a['project']=='mars-analog-rover' else 'support' if ref in anchor else 'lesson'
 modules.append({'ref':ref,'project':a['project'],'module':a['module_id'],'title':a['title'],'version':a['version'],'station':ids[int(a['station'][1:])-1],'kind':'full' if a['source_kind']=='published-full-course' else 'guided','mode':mode,'anchor':anchor.get(ref),'note':notices.get(a['module_id'],'') if a['project']=='mars-analog-rover' else guided_notices.get(ref,''), 'action':a['action']})
stations=[]
for i,s in enumerate(plan['stations']):
 stations.append({'id':ids[i],'code':s['id'],'level':acts[i],'film':films[i],'place':s['title'],'message':s['mission'],'handoff':s['output'],'input':inputs[i],'gate':gates[i],'dependsOn':[ids[int(d[1:])-1] for d in s['depends_on']], 'projects':list(dict.fromkeys(a['project'] for a in modules if a['station']==ids[i])),'steps':[a['ref'] for a in modules if a['station']==ids[i] and a['mode']=='lesson']})
stations[0]['projects']=['spot-a-world','land-a-probe','drive-and-frame']
config={'version':'1.0','mission':'火星地形观察远征','stations':stations,'modules':modules,'micro':['spot-a-world','land-a-probe','drive-and-frame'],'sideQuest':'lightkurve-transit-detective','bridges':[{'id':b['id'],'title':b['goal'],'status':b['status'],'acceptance':b['acceptance']} for b in plan['bridges'][:3]]}
p=root/'packages/student-web/src/lib/project-lines/space-curriculum.json'
p.write_text(json.dumps(config,ensure_ascii=False,indent=2)+'\n')
print(f'{len(modules)} references; {sum(len(s["steps"]) for s in stations)} main steps')
