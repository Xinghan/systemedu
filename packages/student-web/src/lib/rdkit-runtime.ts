/** Explicit, finite teaching model; never executes Python or installs packages. */
export const RUNTIME_SCENES=['goal','places','library','binding','trace','terminal','evidence','next'] as const
export type Environment='A'|'B'
export type RuntimeAction='install-A'|'install-B'|'use-A'|'use-B'|'import'|'print'|'restart'
export type RuntimeState={installed:Record<Environment,boolean>;active:Environment;bound:boolean;session:number}
export const EXAMPLE_VERSION='2025.03.4（固定教学值）'
export const initialRuntime=():RuntimeState=>({installed:{A:false,B:false},active:'A',bound:false,session:1})
export function runRuntime(state:RuntimeState,action:RuntimeAction){
 const next={...state,installed:{...state.installed}};let output='',error=false
 switch(action){
 case 'install-A':case 'install-B':{const e=action==='install-A'?'A':'B';next.installed[e]=true;output=`教学状态：环境 ${e} 已有 RDKit；当前会话的名字不会自动改变。`;break}
 case 'use-A':case 'use-B':next.active=action==='use-A'?'A':'B';next.bound=false;next.session++;output=`在环境 ${next.active} 启动新的教学会话。`;break
 case 'restart':next.bound=false;next.session++;output='会话已重启，名字绑定清空；环境中安装的包仍保留。';break
 case 'import':if(!next.installed[next.active]){output="ModuleNotFoundError: No module named 'rdkit'";error=true}else{next.bound=true;output='导入成功：通常没有输出；当前名字 rdkit 已绑定。'}break
 case 'print':if(!next.bound){output="NameError: name 'rdkit' is not defined";error=true}else output=EXAMPLE_VERSION;break
 }
 return {state:next,action,output,error}
}
export function runtimeTrace(){let state=initialRuntime();return [{state,action:null,output:'尚未运行；以下是有限状态教学模型。',error:false},...(['install-A','import','print','restart','import','print'] as RuntimeAction[]).map(action=>{const result=runRuntime(state,action);state=result.state;return result})]}
export const CHECK_SCRIPT=`import sys
import json
import rdkit

print(json.dumps({
    "python": sys.version.split()[0],
    "executable": sys.executable,
    "rdkit": rdkit.__version__
}, ensure_ascii=False, indent=2))`
export const EVIDENCE_KEY='systemedu:molecule:M02:runtime-evidence:v1'
export type RuntimeEvidence={schema:'m02-runtime-evidence-v1';source:'learner-reported-python';python:string;executable:string;rdkit:string;confirmed:true;independentlyVerified:false}
export function parseRuntimeOutput(raw:string,confirmed:boolean):{evidence:RuntimeEvidence|null;problem:string}{
 if(!raw.trim())return {evidence:null,problem:'请粘贴你自己运行脚本得到的 JSON；不要用教学示例代替。'}
 if(raw.length>5000)return {evidence:null,problem:'输出过长；只保留脚本输出的 JSON，勿粘贴完整终端历史。'}
 let obj:Record<string,unknown>;try{obj=JSON.parse(raw);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw Error()}catch{return {evidence:null,problem:'不是有效 JSON，请检查花括号、英文双引号和逗号。'}}
 if(typeof obj.python!=='string'||!/^3\.\d+\.\d+(?:[A-Za-z0-9.+-]*)$/.test(obj.python))return {evidence:null,problem:'缺少有效 python 版本字段，例如运行结果中的 3.x.y；请复制实际值。'}
 if(typeof obj.rdkit!=='string'||!/^20\d{2}\.\d{1,2}\.\d+(?:[A-Za-z0-9.+-]*)$/.test(obj.rdkit))return {evidence:null,problem:'缺少有效 rdkit 版本字段；不能填写 VERSION 或“固定教学值”。'}
 if(typeof obj.executable!=='string'||!obj.executable.trim()||obj.executable.length>500)return {evidence:null,problem:'缺少 executable：需要知道你使用哪个 Python。可自行遮去路径中的用户名。'}
 if(!confirmed)return {evidence:null,problem:'请确认这是你实际运行得到的输出，不是页面示例。'}
 return {evidence:{schema:'m02-runtime-evidence-v1',source:'learner-reported-python',python:obj.python,rdkit:obj.rdkit,executable:obj.executable.trim(),confirmed:true,independentlyVerified:false},problem:''}
}
export function restoreRuntimeEvidence(raw:string|null){if(!raw)return null;try{const o=JSON.parse(raw);if(o.schema!=='m02-runtime-evidence-v1'||o.source!=='learner-reported-python'||o.confirmed!==true||o.independentlyVerified!==false)return null;return parseRuntimeOutput(JSON.stringify(o),true).evidence}catch{return null}}
