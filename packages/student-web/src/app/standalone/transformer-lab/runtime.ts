// The runner iframe has an opaque origin (sandbox=allow-scripts, no same-origin).
// Each invocation gets a fresh worker/CPython interpreter. It never receives app data.
export const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/"
const SCRIPT_HARNESS = "import json, numpy as np\nexec(_student_code, {'np': np})\njson.dumps({'ok': True})"
const HARNESS = [
  "import json, numpy as np",
  "def stable_softmax(scores, axis=-1):",
  "    shifted = scores - np.max(scores, axis=axis, keepdims=True)",
  "    exp = np.exp(shifted)",
  "    return exp / np.sum(exp, axis=axis, keepdims=True)",
  "_student_scope = {'np': np, 'stable_softmax': stable_softmax}",
  "exec(_student_code, _student_scope)",
  "_fn = _student_scope.get('causal_attention')",
  "if not callable(_fn):",
  "    raise ValueError('请定义 causal_attention(Q, K, V) 函数')",
  "_outputs = []",
  "for _case in json.loads(_cases_json):",
  "    _q, _k, _v = [np.array(_case[key], dtype=float) for key in ('Q', 'K', 'V')]",
  "    try:",
  "        _w, _o = _fn(_q, _k, _v)",
  "        _w, _o = np.asarray(_w), np.asarray(_o)",
  "        if _w.size > 10000 or _o.size > 10000:",
  "            raise ValueError('返回矩阵超过本关大小限制')",
  "        if not np.all(np.isfinite(_w)) or not np.all(np.isfinite(_o)):",
  "            raise ValueError('输出包含 NaN/Infinity，请检查 mask 和数值稳定性')",
  "        _outputs.append({'weights': _w.tolist(), 'output': _o.tolist()})",
  "    except Exception as _error:",
  "        _outputs.append({'error': str(_error)[:1000]})",
  "json.dumps(_outputs, allow_nan=False)",
].join("\n")

export function runtimeDocument(channel: string, parentOrigin: string) {
  const worker = [
    "(async () => {",
    "let output = '';",
    "try {",
    " importScripts(" + JSON.stringify(PYODIDE_BASE + "pyodide.js") + ");",
    " const py = await loadPyodide({ indexURL: " + JSON.stringify(PYODIDE_BASE) + ", stdout: s => { output = (output + s + '\\n').slice(0, 5000) }, stderr: s => { output = (output + s + '\\n').slice(0, 5000) } });",
    " await py.loadPackage('numpy');",
    " self.postMessage({type:'ready'});",
    " self.onmessage = async e => {",
    "  output = '';",
    "  try {",
    "   py.globals.set('_student_code', e.data.code);",
    "   py.globals.set('_cases_json', JSON.stringify(e.data.cases));",
    "   const result = await py.runPythonAsync(e.data.mode === 'script' ? " + JSON.stringify(SCRIPT_HARNESS) + " : " + JSON.stringify(HARNESS) + ");",
    "   if (result.length > 100000) throw new Error('输出超过大小限制');",
    "   self.postMessage({type:'result', result, stdout: output});",
    "  } catch (error) { self.postMessage({type:'result', result:'[]', error:String(error).slice(0,5000), stdout:output}); }",
    " };",
    "} catch (error) { self.postMessage({type:'load-error', error:String(error).slice(0,2000)}); }",
    "})();",
  ].join("\n")
  const bridge = [
    "const channel = " + JSON.stringify(channel) + ";",
    "const parentOrigin = " + JSON.stringify(parentOrigin) + ";",
    "const url = URL.createObjectURL(new Blob([" + JSON.stringify(worker) + "], {type:'text/javascript'}));",
    "let worker;",
    "function send(data) { parent.postMessage({...data, channel}, parentOrigin); }",
    "try {",
    " worker = new Worker(url);",
    " worker.onmessage = e => send(e.data);",
    " worker.onerror = e => send({type:'load-error', error:e.message || '浏览器未能启动隔离的 Worker。'});",
    "} catch (e) { send({type:'load-error', error:String(e)}); }",
    "window.addEventListener('message', e => {",
    " if (e.source !== parent || e.origin !== parentOrigin || e.data?.channel !== channel) return;",
    " if (e.data.type === 'run') worker?.postMessage({code:e.data.code, cases:e.data.cases, mode:e.data.mode});",
    " if (e.data.type === 'stop') { worker?.terminate(); URL.revokeObjectURL(url); }",
    "});",
  ].join("\n").replace(/<\/script/gi, "<\\/script")
  return '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'nonce-' + channel + "' 'unsafe-eval' blob: https://cdn.jsdelivr.net; worker-src blob:; connect-src https://cdn.jsdelivr.net; base-uri 'none'; form-action 'none'\"></head><body><script nonce=\"" + channel + '">' + bridge + "</script></body></html>"
}
