"""Independently replay each slide's visible state using actual Python."""
import contextlib,io,json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
DOC=json.loads((ROOT/'course_factory/fixtures/molecule-monster-hunter/M08-variable-consecutive-v2.json').read_text())
class TraceTests(unittest.TestCase):
    def test_every_visible_state(self):
        count=0
        for slide in DOC['slides']:
            visual=slide['payload']['technical_visual']
            for step in visual['steps']:
                with self.subTest(slide=slide['slide_id'],step=step['title']):
                    code=step.get('code',visual['code']);line=max(step['active_lines'],default=0)
                    env={};output=io.StringIO();error=None
                    try:
                        with contextlib.redirect_stdout(output):exec('\n'.join(code.splitlines()[:line]),{'__builtins__':{'print':print}},env)
                    except NameError as e:error='NameError: '+str(e)
                    self.assertEqual(step.get('output',''),output.getvalue().rstrip('\n'))
                    self.assertEqual(step.get('error'),error)
                    self.assertEqual(step.get('variables',[]),[{'name':k,'value':repr(v)} for k,v in env.items()])
                    count+=1
        self.assertEqual(count,35)
    def test_identity_and_boundaries(self):
        original=json.loads((ROOT/'artifacts/molecule-m08-20260914/before/slides.json').read_text())
        self.assertEqual(len(DOC['slides']),8)
        for old,new in zip(original['slides'],DOC['slides']):
            for k in ['slide_id','kind']:self.assertEqual(old[k],new[k])
            for k in ['theory_id','idea_id']:self.assertEqual(old['payload'].get(k),new['payload'].get(k))
            self.assertIsNone(new['audio_path'])
            self.assertTrue(new['payload']['technical_visual']['aria_label'].startswith('M08 ·'))
        self.assertIn('M09',DOC['slides'][-1]['audio_script'])
        self.assertIn('M10',DOC['slides'][-1]['audio_script'])
if __name__=='__main__':unittest.main()
