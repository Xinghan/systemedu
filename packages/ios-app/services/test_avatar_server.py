import io
import time
import unittest
from PIL import Image
from avatar_server import Jobs, clean_image, FRAMING

class AvatarTests(unittest.TestCase):
    def test_strips_metadata_and_bounds_dimensions(self):
        image = Image.new('RGB', (2048, 1024), 'navy')
        data = io.BytesIO(); image.save(data, 'JPEG', comment=b'private metadata')
        result = Image.open(io.BytesIO(clean_image(data.getvalue())))
        self.assertEqual(result.size, (1024, 512)); self.assertNotIn('comment', result.info)
        with self.assertRaises(Exception): clean_image(b'not an image')

    def test_idempotency_delete_and_failed_jobs(self):
        calls = []
        def provider(photo):
            calls.append(photo); time.sleep(.03); return b'generated'
        jobs = Jobs(provider); key = 'a'*32
        self.assertEqual(jobs.start(key, b'photo'), 202)
        self.assertEqual(jobs.start(key, b'photo'), 202)
        self.assertEqual(jobs.start('b'*32, b'photo'), 429)
        jobs.remove(key); jobs.pool.shutdown(wait=True)
        self.assertIsNone(jobs.get(key)); self.assertEqual(len(calls), 1)
        with self.assertRaises(ValueError): jobs.start('../bad', b'photo')

    def test_portrait_aspect_and_ready_contract(self):
        image = Image.new('RGB', (1024, 1536), 'navy')
        data = io.BytesIO(); image.save(data, 'PNG')
        clean = clean_image(data.getvalue())
        with Image.open(io.BytesIO(clean)) as portrait:
            self.assertEqual(portrait.size, (683, 1024))
        jobs = Jobs(lambda _: clean); key = 'c' * 32
        jobs.start(key, b'synthetic fixture'); jobs.pool.shutdown(wait=True)
        self.assertEqual(jobs.get(key)['status'], 'ready')
        self.assertEqual(jobs.get(key)['framing'], FRAMING)
        jobs.remove(key); self.assertIsNone(jobs.get(key))

if __name__ == '__main__': unittest.main()
