"""Synthetic fixtures exercise selection; they are not course QA evidence."""
import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from ios_media import CHECKS, read_variants


class IOSMediaTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.node = Path(self.temp.name)
        self.sections = {'rendered_sections': {'anim_1': {'mode': 'animation', 'html': 'desktop original'}, 'game_1': {'mode': 'game'}}}
        self.media = self.node / 'mobile/ios'
        self.media.mkdir(parents=True)
        self.html = self.media / 'anim_1/r1/index.html'
        self.html.parent.mkdir(parents=True)
        self.html.write_text('<!doctype html><p>Test-only mobile fixture</p>')
        self.script = self.html.with_name('scene.js')
        self.script.write_text('/* test-only dependency */')
        self.files = {str(p.relative_to(self.media)): hashlib.sha256(p.read_bytes()).hexdigest() for p in [self.html, self.script]}
        self.review = self.node / 'authoring/ios/anim_1/r1/review.json'
        self.review.parent.mkdir(parents=True)
        self.evidence = self.review.with_name('test-only.log')
        self.evidence.write_text('Synthetic test fixture, not an actual acceptance report.')
        self.review_data = {'status': 'pass', 'checks': dict.fromkeys(CHECKS, 'pass'), 'files': self.files, 'evidence': [str(self.evidence.relative_to(self.node))]}
        self.review.write_text(json.dumps(self.review_data))
        self.variant = dict(kind='animation', revision='r1', status='verified', entry='anim_1/r1/index.html', state_key='ios:test-course:M03:anim_1:r1', files=self.files, review=str(self.review.relative_to(self.node)))

    def write(self, variant=None):
        (self.media / 'manifest.json').write_text(json.dumps({'schema_version': 1, 'target': 'ios', 'variants': {'anim_1': variant or self.variant}}))

    def select(self, **options):
        return read_variants(self.node, self.sections, 'test-course', 'M03', **options)

    def test_legacy_and_unfinished_draft_keep_existing_resources(self):
        before = copy.deepcopy(self.sections)
        selected, tracked, coverage = self.select()
        self.assertEqual(selected, {})
        self.assertEqual(tracked, [])
        self.assertEqual(coverage, {'anim_1': 'legacy', 'game_1': 'legacy'})
        self.write({'kind': 'animation', 'status': 'draft'})
        selected, tracked, coverage = self.select()
        self.assertEqual(selected, {})
        self.assertEqual(coverage['anim_1'], 'draft')
        self.assertEqual(self.sections, before)

    def test_verified_variant_keeps_id_and_tracks_dependencies_and_evidence(self):
        self.write()
        selected, tracked, coverage = self.select()
        self.assertEqual(list(selected), ['anim_1'])
        self.assertEqual(selected['anim_1']['path'], 'mobile/ios/anim_1/r1/index.html')
        self.assertEqual(coverage, {'anim_1': 'verified', 'game_1': 'legacy'})
        self.assertTrue({self.html, self.script, self.review, self.evidence}.issubset(tracked))
        self.assertEqual(self.sections['rendered_sections']['anim_1']['html'], 'desktop original')

    def test_draft_preview_does_not_require_fabricated_review(self):
        self.variant['status'] = 'draft'
        self.review.unlink(); self.evidence.unlink()
        self.write()
        selected, _, coverage = self.select(preview=True)
        self.assertIn('anim_1', selected)
        self.assertEqual(coverage['anim_1'], 'preview')
        self.assertEqual(self.select()[0], {})
        self.script.write_text('changed after draft hash')
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            self.select(preview=True)

    def test_stale_or_missing_files_fail_instead_of_silent_fallback(self):
        self.write(); self.script.write_text('changed')
        with self.assertRaisesRegex(ValueError, 'hash mismatch'):
            self.select()
        self.script.unlink()
        with self.assertRaisesRegex(ValueError, 'Missing iOS file'):
            self.select()

    def test_unknown_ids_kind_and_unversioned_storage_are_rejected(self):
        self.write(); self.sections['rendered_sections'].pop('anim_1')
        with self.assertRaisesRegex(ValueError, 'existing animation/game ID'):
            self.select()
        self.sections['rendered_sections']['anim_1'] = {'mode': 'game'}
        with self.assertRaisesRegex(ValueError, 'kind'):
            self.select()
        self.sections['rendered_sections']['anim_1']['mode'] = 'animation'
        self.variant['state_key'] = 'shared-old-record'
        self.write()
        with self.assertRaisesRegex(ValueError, 'state key'):
            self.select()

    def test_unreviewed_or_stale_review_cannot_be_selected(self):
        self.write()
        for change in [{'checks': {'layout': 'pass'}}, {'files': {}}, {'evidence': []}]:
            self.review.write_text(json.dumps({**self.review_data, **change}))
            with self.assertRaises(ValueError):
                self.select()
        self.review.write_text(json.dumps(self.review_data)); self.evidence.unlink()
        with self.assertRaisesRegex(ValueError, 'Missing iOS file'):
            self.select()

    def test_traversal_and_symbolic_links_are_rejected(self):
        for relative in ['../outside.html', '/tmp/outside.html', 'anim_1/../../outside.html']:
            self.variant['files'] = {**self.files, relative: '0' * 64}
            self.write()
            with self.assertRaisesRegex(ValueError, 'Unsafe iOS file'):
                self.select()
        self.variant['files'] = self.files
        self.write()
        self.html.unlink(); self.html.symlink_to(self.script)
        with self.assertRaisesRegex(ValueError, 'Symlink'):
            self.select()


if __name__ == '__main__':
    unittest.main()
