import base64
import http.client
import io
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from PIL import Image
import avatar_server
from camera_bridge import CameraSessions


class CameraTests(unittest.TestCase):
    def setUp(self):
        self.now = 100.0
        self.opened = []
        self.sessions = CameraSessions(avatar_server.clean_image, self.opened.append, lambda: self.now)
        self.ident, self.reader = 'a' * 32, 'b' * 64
        self.sessions.start(self.ident, self.reader, 'http://127.0.0.1:8769')
        self.writer = self.opened[0].split('.')[-1]
        image = io.BytesIO()
        Image.new('RGB', (128, 96), 'navy').save(image, 'JPEG', comment=b'private metadata')
        self.jpeg = image.getvalue()

    def test_capabilities_separate_read_and_write(self):
        self.assertFalse(self.sessions.frame(self.ident, self.reader, self.jpeg))
        self.assertTrue(self.sessions.frame(self.ident, self.writer, self.jpeg))
        self.assertIsNone(self.sessions.get(self.ident, self.writer, 'reader'))
        self.assertIsNone(self.sessions.get(self.ident, '', 'reader'))
        self.assertNotIn('image', self.sessions.get(self.ident, self.writer, 'writer'))
        result = self.sessions.get(self.ident, self.reader, 'reader')
        image = Image.open(io.BytesIO(base64.b64decode(result['image'])))
        self.assertEqual(image.size, (128, 96))
        self.assertNotIn('comment', image.info)

    def test_cancel_drops_frames_and_prevents_late_writes(self):
        self.sessions.frame(self.ident, self.writer, self.jpeg)
        self.assertFalse(self.sessions.remove(self.ident, 'bad'))
        self.assertTrue(self.sessions.remove(self.ident, self.reader))
        self.assertFalse(self.sessions.frame(self.ident, self.writer, self.jpeg))
        self.assertIsNone(self.sessions.item)

    def test_stale_frame_and_disconnected_reader_expire(self):
        self.sessions.frame(self.ident, self.writer, self.jpeg)
        self.now += 4
        self.assertNotIn('image', self.sessions.get(self.ident, self.reader, 'reader'))
        self.now += 11
        self.assertIsNone(self.sessions.get(self.ident, self.writer, 'writer'))
        self.assertIsNone(self.sessions.item)

    def test_hard_expiry_even_with_active_reader(self):
        for _ in range(18):
            self.now += 10
            self.assertIsNotNone(self.sessions.get(self.ident, self.reader, 'reader'))
        self.now += 1
        self.assertIsNone(self.sessions.get(self.ident, self.reader, 'reader'))

    def test_single_session_idempotency_and_invalid_image(self):
        self.sessions.start(self.ident, self.reader, 'http://127.0.0.1:8769')
        self.assertEqual(len(self.opened), 1)
        with self.assertRaises(RuntimeError): self.sessions.start('c' * 32, 'd' * 64, 'local')
        with self.assertRaises(ValueError): self.sessions.start('../bad', self.reader, 'local')
        with self.assertRaises(Exception): self.sessions.frame(self.ident, self.writer, b'bad image')
        self.assertNotIn('image', self.sessions.get(self.ident, self.reader, 'reader'))

    def test_permission_failure_removes_image(self):
        self.sessions.frame(self.ident, self.writer, self.jpeg)
        self.assertTrue(self.sessions.fail(self.ident, self.writer, 'NotAllowedError'))
        result = self.sessions.get(self.ident, self.reader, 'reader')
        self.assertEqual(result['status'], 'failed')
        self.assertIn('权限', result['message'])
        self.assertNotIn('image', result)


class CameraHTTPTests(unittest.TestCase):
    def setUp(self):
        self.old = avatar_server.cameras
        self.opened = []
        avatar_server.cameras = CameraSessions(avatar_server.clean_image, self.opened.append)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), avatar_server.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_port
        self.origin = f'http://127.0.0.1:{self.port}'
        self.ident, self.reader = 'a' * 32, 'b' * 64

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        avatar_server.cameras = self.old

    def request(self, method, path, data=None, headers=None):
        client = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        client.request(method, path, data, headers or {})
        response = client.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        client.close()
        return result

    def start(self, headers=None):
        return self.request('POST', '/camera', json.dumps({'id': self.ident, 'reader': self.reader}),
                            {'Content-Type': 'application/json', 'X-SystemEdu-Camera': 'simulator', **(headers or {})})

    def test_origin_host_and_start_protection(self):
        self.assertEqual(self.start({'Origin': 'https://untrusted.example'})[0], 403)
        self.assertEqual(self.start({'Origin': self.origin})[0], 403)
        self.assertEqual(self.start({'Host': 'untrusted.example'})[0], 403)
        self.assertEqual(self.start({'X-SystemEdu-Camera': ''})[0], 403)
        self.assertEqual(self.start()[0], 202)
        self.assertEqual(len(self.opened), 1)

    def test_http_roles_validation_headers_and_deletion(self):
        self.assertEqual(self.start()[0], 202)
        path = '/camera/' + self.ident
        writer = self.opened[0].split('.')[-1]
        self.assertEqual(self.request('GET', path, headers={'X-Camera-Token': writer})[0], 404)
        self.assertEqual(self.request('POST', path + '/frame', b'invalid', {'Content-Type': 'image/jpeg', 'X-Camera-Token': writer})[0], 400)
        self.assertEqual(self.request('POST', path + '/frame', b'', {'Content-Length': '500001', 'Content-Type': 'image/jpeg', 'X-Camera-Token': writer})[0], 400)
        code, headers, _ = self.request('GET', '/camera')
        self.assertEqual(code, 200)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        self.assertIn("frame-ancestors 'none'", headers['Content-Security-Policy'])
        self.assertEqual(self.request('GET', '/camera/../avatar_server.py')[0], 404)
        self.assertEqual(self.request('DELETE', path, headers={'X-Camera-Token': self.reader})[0], 200)
        self.assertEqual(self.request('GET', path, headers={'X-Camera-Token': self.reader})[0], 404)


if __name__ == '__main__': unittest.main()
