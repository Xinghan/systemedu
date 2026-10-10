import importlib.util, json, sys, tempfile, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("molecule_numbering", ROOT/"scripts/course_migrations/molecule_numbering.py")
m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)

class NumberingTests(unittest.TestCase):
    def test_bijection_and_collision(self):
        self.assertEqual(list(m.ID_MAP.values()),[f"M{i:02}" for i in range(1,48)])
        self.assertEqual(m.ID_MAP["M23"],"M07")
        self.assertEqual(m.ID_MAP["M51"],"M23")
        self.assertEqual(m.rewrite_text("M23 接 M51，M90 收官"),"M07 接 M23，M47 收官")
    def test_html_never_rewrites_svg_path_or_code(self):
        html='<svg><path d="M23 30 L51 60"/><text>M23 取数</text></svg><script>const path="M23 30";</script><a href="knodes/M23-w0-pubchem-smiles/lesson.md">M23</a>'
        out=m.rewrite_html(html)
        self.assertIn('d="M23 30 L51 60"',out)
        self.assertIn('const path="M23 30"',out)
        self.assertIn('<text>M07 取数</text>',out)
        self.assertIn('knodes/M07-w0-pubchem-smiles/lesson.md',out)
    def test_urls_and_unknown_tokens_not_guessed(self):
        self.assertEqual(m.rewrite_text("M23 M230 AM23 M23abc"),"M07 M230 AM23 M23abc")
        html='<a href="https://example.org/M23">M23</a>'
        self.assertIn('https://example.org/M23',m.rewrite_html(html))
        self.assertIn('>M07<',m.rewrite_html(html))
    def test_only_known_node_directory_is_relocated(self):
        self.assertEqual(m.rewrite_path("knodes/M23-w0-pubchem-smiles/slides.json"),"knodes/M07-w0-pubchem-smiles/slides.json")
        self.assertEqual(m.rewrite_path("knodes/M51-w0-module/slides.json"),"knodes/M23-w0-module/slides.json")
        self.assertEqual(m.rewrite_path("images/M23.png"),"images/M23.png")
    def test_json_assets_and_anchors_are_preserved(self):
        obj={"module_id":"M23","title":"M23 取数","html":'<path d="M23 5"/>',"image_path":"/slide-assets/molecule/M23.png","lesson_anchor":{"id":"theory_m23"}}
        out=m.rewrite_json(obj)
        self.assertEqual(out["module_id"],"M07")
        self.assertEqual(out["image_path"],obj["image_path"])
        self.assertEqual(out["lesson_anchor"],obj["lesson_anchor"])
        self.assertEqual(out["html"],obj["html"])
    def test_changed_narration_unbinds_old_audio(self):
        obj={"slides":[{"slide_id":"s1","audio_script":"接续M23","audio_path":"audio/s1.wav","payload":{}}]}
        out=m.rewrite_json(obj)
        self.assertIsNone(out["slides"][0]["audio_path"])
        self.assertEqual(out["slides"][0]["slide_id"],"s1")
    def test_inline_svg_payload_preserves_move_commands(self):
        source={"payload":{"inline_svg":"<svg><path d='M30 21 v6 M30 30 h0.1'/><text>M32 pandas</text></svg>"}}
        out=m.rewrite_json(source)["payload"]["inline_svg"]
        self.assertIn("d='M30 21 v6 M30 30 h0.1'",out)
        self.assertIn('<text>M13 pandas</text>',out)
    def test_tree_uses_new_ids_order_and_valid_edges(self):
        source=m.CANONICAL
        if json.loads((source/'manifest.json').read_text())['version']!='0.1.0':
            source=ROOT.parent/'systemeduidea/course-backups/molecule-monster-hunter-legacy-v1-20260914'
        tree=json.loads((source/"tree/knowledge_tree.json").read_text())
        out=m.rewrite_tree(tree)
        self.assertEqual([x["module_id"] for x in out["modules"]],[f"M{i:02}" for i in range(1,48)])
        self.assertEqual([x["sequence_order"] for x in out["modules"]],list(range(1,48)))
        self.assertEqual(out["modules"][6]["depends_on"],["M06"])
        self.assertEqual(out["stages"][1]["closing_capstone_module_id"],"M16")
        self.assertEqual(out["numbering_version"],"consecutive-v2")
        with self.assertRaises(ValueError):m.rewrite_tree(out)
    def test_repeated_conversion_is_not_guessed_from_id(self):
        self.assertEqual(m.ID_MAP["M23"],"M07")
        self.assertEqual(m.ID_MAP["M51"],"M23")
        # Only the artifact version can tell whether a current M23 is already new.
        self.assertEqual(len(set(m.ID_MAP.values())),47)

if __name__=="__main__":unittest.main()
