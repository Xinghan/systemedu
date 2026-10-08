"use client"

import { useEffect, useState, type ReactNode } from 'react'
import type { SlideTechnicalVisual } from '@/lib/types/api'
import { getRDKitModule } from '@/lib/rdkit'
import { CHECK_SCRIPT, initialRuntime, runRuntime, runtimeTrace, type RuntimeAction, type RuntimeState } from '@/lib/rdkit-runtime'
import { useReadonlySteps } from './readonly-presentation'
import './rdkit-runtime.css'
import './science-readonly.css'

type Spec = Extract<SlideTechnicalVisual, { renderer: 'rdkit-runtime' }>
const ACTION_CODE: Record<RuntimeAction, string> = { 'install-A': 'A: python -m pip install rdkit', 'install-B': 'B: python -m pip install rdkit', 'use-A': '在 A 启动新会话', 'use-B': '在 B 启动新会话', import: 'import rdkit', print: 'print(rdkit.__version__)', restart: '重新启动解释器 / kernel' }
function Code({ children }: { children: string }) { return <pre className="rr-code"><code>{children}</code></pre> }
function Note({ children }: { children: ReactNode }) { return <aside className="rr-note">{children}</aside> }
function State({ state }: { state: RuntimeState }) {
  return <dl className="sr-fields"><dt>当前环境</dt><dd>{state.active} · 会话 #{state.session}</dd><dt>环境 A 的包</dt><dd>{state.installed.A ? 'RDKit 已安装' : '尚未安装'}</dd><dt>环境 B 的包</dt><dd>{state.installed.B ? 'RDKit 已安装' : '尚未安装'}</dd><dt>当前 rdkit 名字</dt><dd>{state.bound ? '已导入，绑定模块对象' : '未绑定'}</dd></dl>
}
function RuntimeTrace() {
  const rows = runtimeTrace(), { root, step } = useReadonlySteps(rows.length), current = rows[step]
  return <section ref={root} data-demo-step={step}>
    <div className="rr-two"><section><p className="rr-kicker">自动讲解 · 步骤 {step + 1} / {rows.length}</p><Code>{current.action ? ACTION_CODE[current.action] : '尚未执行'}</Code><p className="rr-log">{current.output}</p></section><section className="rr-panel"><h3>同一步骤的环境与会话</h3><State state={current.state} /></section></div>
    <table><caption>完整轨迹 · 所有状态始终可读</caption><thead><tr><th>动作</th><th>A 中已安装？</th><th>会话 / 名字绑定</th><th>输出或解释</th></tr></thead><tbody>{rows.map((r, i) => <tr key={i} data-runtime-trace={i} className={i === step ? 'sr-active' : ''}><th>{i + 1} · <code>{r.action ? ACTION_CODE[r.action] : '开始'}</code></th><td>{r.state.installed.A ? '是' : '否'}</td><td>#{r.state.session} / {r.state.bound ? 'rdkit 已绑定' : '未绑定'}</td><td>{r.output}</td></tr>)}</tbody></table>
    <Note>这是有限状态教学模型，不执行 Python 或安装。版本是固定教学值，不能当作你的环境证据；导入成功通常没有输出，读取版本才会打印。</Note>
  </section>
}
type LibraryRow = { smiles: string; name: string; svg: string; mass: number | null; error: string }
function LibraryExamples() {
  const [result, setResult] = useState<{ version: string; rows: LibraryRow[]; error?: string } | null>(null)
  useEffect(() => {
    let live = true
    getRDKitModule().then(rdkit => {
      const rows = [['CCO', '乙醇'], ['O', '水'], ['C1CC', '未闭合的环标记']].map(([smiles, name]) => {
        let mol = null
        try {
          mol = rdkit.get_mol(smiles)
          if (!mol || !mol.is_valid()) return { smiles, name, svg: '', mass: null, error: '无法解析 · 不进入质量计算' }
          return { smiles, name, svg: mol.get_svg_with_highlights(JSON.stringify({ width: 420, height: 180, explicitMethyl: true })), mass: JSON.parse(mol.get_descriptors()).amw as number, error: '' }
        } catch { return { smiles, name, svg: '', mass: null, error: '无法解析 · 不进入质量计算' } }
        finally { mol?.delete() }
      })
      if (live) setResult({ version: rdkit.version(), rows })
    }).catch(() => { if (live) setResult({ version: '不可用', rows: [], error: '浏览器结构库暂不可用；下方代码和输入边界仍可阅读。' }) })
    return () => { live = false }
  }, [])
  return <><p className="rr-kicker">真实浏览器 RDKit.js · {result?.version || '加载中'}</p><div className="sr-three">{result?.rows.map(r => <section className="rr-panel" key={r.smiles}><h3>{r.name}</h3><code>{r.smiles}</code>{r.svg ? <div role="img" aria-label={`${r.name} RDKit 结构`} dangerouslySetInnerHTML={{ __html: r.svg }} /> : <p className="rr-note">{r.error}</p>}<dl><dt>平均摩尔质量</dt><dd data-library-mass={r.smiles}>{r.mass === null ? '未计算' : `${r.mass.toFixed(3)} g/mol`}</dd></dl></section>) || <p>正在解析三个固定输入…</p>}</div>{result?.error && <p role="status">{result.error}</p>}<Code>{'from rdkit import Chem\nfrom rdkit.Chem import Descriptors\n\nfor smiles in ["CCO", "O", "C1CC"]:\n    mol = Chem.MolFromSmiles(smiles)\n    if mol is not None:\n        print(smiles, Descriptors.MolWt(mol))\n    else:\n        print(smiles, "invalid")'}</Code><Note>结构有效后才计算；无效写法没有分子量。这里的图与数值由浏览器 RDKit 计算，不证明本机 Python 已安装，也不是药效预测。</Note></>
}
function ErrorCases() {
  const empty = initialRuntime(), installedB = runRuntime(empty, 'install-B').state, installedA = runRuntime(empty, 'install-A').state
  const cases = [
    { cause: '有包，但会话未导入', state: installedA, action: 'print' as const, fix: '先在当前会话 import rdkit，再读取版本。' },
    { cause: '装在 B，却在 A 导入', state: installedB, action: 'import' as const, fix: '核对解释器 / kernel，使用已安装的环境，或安装到要使用的环境。' },
    { cause: '已导入，随后重启', state: runRuntime(runRuntime(installedA, 'import').state, 'restart').state, action: 'print' as const, fix: '包仍在 A；重新导入，而不是无条件重装。' },
  ]
  return <><table><caption>三种固定情形 · 定位错误发生在哪一层</caption><thead><tr><th>条件</th><th>尝试的语句</th><th>模型结果</th><th>修复依据</th></tr></thead><tbody>{cases.map(c => <tr key={c.cause}><th>{c.cause}</th><td><code>{ACTION_CODE[c.action]}</code></td><td><code>{runRuntime(c.state, c.action).output}</code></td><td>{c.fix}</td></tr>)}</tbody></table><Note>NameError 检查当前名字；ModuleNotFoundError 检查当前环境是否找得到包。上表是有限模型的预期结果，不是实际执行日志。</Note></>
}
export function RdkitRuntimeReadonly({ visual }: { visual: Spec }) {
  let body: ReactNode
  switch (visual.scene) {
    case 'goal': body = <><ol className="sr-three sr-path"><li><b>M01 / 定义目标</b><h3>研究问题与产物</h3><p>确定要比较什么、最终交出什么证据。</p></li><li><b>M02 / 准备工具</b><h3>选定 Python 环境</h3><p>安装包 → 当前会话导入 → 读取版本。</p></li><li><b>M03 / 接续使用</b><h3>结构与计数</h3><p>在已核对的环境里画结构、读出原子与连接。</p></li></ol><table><tbody><tr><th>需要保留</th><td>Python 版本、解释器位置、RDKit 版本，以及实际脚本和日志。</td></tr><tr><th>网页能做</th><td>演示浏览器 RDKit 的图与数值，解释检查方法。</td></tr><tr><th>网页不能证明</th><td>你的本机 Python 已安装好；本页不读取或检查个人记录。</td></tr></tbody></table><Note>安装请家长协助。导入通过只是基础检查，不等于后续所有算法都已经验证。</Note></>; break
    case 'places': body = <><div className="rr-two"><section className="rr-panel"><h3>Jupyter / IPython 单元格</h3><p className="rr-kicker">安装到当前 kernel 使用的环境</p><Code>{'%pip install rdkit'}</Code><p>这是 IPython magic，不是普通 Python 语法。按安装提示重启 kernel 后，再导入：</p><Code>{'import rdkit\nprint(rdkit.__version__)'}</Code></section><section className="rr-panel"><h3>终端 / Anaconda Prompt</h3><p className="rr-kicker">先进入老师指定的环境</p><Code>{'python -m pip install rdkit'}</Code><p>python 指向要使用的解释器，有些系统命令为 python3。随后执行：</p><Code>{'python -c "import rdkit; print(rdkit.__version__)"'}</Code></section></div><Note>安装命令不粘在 Python 的 <code>&gt;&gt;&gt;</code> 提示符后。网络、平台和 Python 版本会影响安装；这里不执行任何命令。</Note></>; break
    case 'library': body = <LibraryExamples />; break
    case 'binding': { const installed = runRuntime(initialRuntime(), 'install-A').state, imported = runRuntime(installed, 'import').state, restarted = runRuntime(imported, 'restart').state; body = <><div className="sr-three">{[['① 安装到 A', installed], ['② 当前会话导入', imported], ['③ 重启会话', restarted]].map(([title, state]) => <section className="rr-panel" key={title as string}><h3>{title as string}</h3><State state={state as RuntimeState} /></section>)}</div><Note>包保留在环境里，名字属于当前会话。重启清空名字，不卸载包；同一会话的后续单元格可使用已导入的名字，Chem 等子模块仍需显式导入。</Note></>; break }
    case 'trace': body = <RuntimeTrace />; break
    case 'terminal': body = <ErrorCases />; break
    case 'evidence': body = <div className="rr-two"><section><h3>检查脚本：它会读出哪些字段？</h3><Code>{CHECK_SCRIPT}</Code><p className="rr-small">这是可读的 Python 模板，本页不执行。课后在自己的环境运行后保留实际输出。</p></section><section className="rr-panel"><h3>运行证据的三项内容</h3><table><thead><tr><th>字段</th><th>它回答什么问题？</th></tr></thead><tbody><tr><th><code>python</code></th><td>当前 Python 的实际版本。</td></tr><tr><th><code>executable</code></th><td>当前使用哪个解释器，是否与安装目标一致。</td></tr><tr><th><code>rdkit</code></th><td>这个环境实际导入的 RDKit 版本。</td></tr></tbody></table><Note>保存的是本人运行证据，不是网页版本或固定教学值。本页不提供填写或提交入口，不替你宣告完成。</Note><p className="rr-small">路径中的用户名可遮去，不必提交密码、手机号或完整终端历史。</p></section></div>; break
    case 'next': body = <><ol className="sr-three sr-path"><li><b>输入</b><h3>M02 的实际记录</h3><p>脚本、版本、解释器位置和真实输出。</p></li><li><b>接续条件</b><h3>同一环境与导入</h3><p>换环境或重启后，重新核对包和名字。</p></li><li><b>下一件产物</b><h3>M03 骨架报告</h3><p>结构写法 → 精确图 → 原子、连接、环的计数。</p></li></ol><Note>本页解释任务衔接，不查看完成状态。格式完整或版本一致，也不能证明每个化学算法或模型已经验证。</Note></>; break
  }
  return <section className="rr sr-readonly" data-renderer="rdkit-runtime" data-scene={visual.scene} data-presentation="readonly">{body}<footer>只读教学示例 · 不安装软件、不读写个人草稿；实际运行与提交在课后任务中完成。</footer></section>
}
