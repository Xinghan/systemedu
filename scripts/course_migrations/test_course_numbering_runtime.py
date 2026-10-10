import hashlib, json, os, sys, unittest
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import create_engine, text
from starlette.applications import Starlette
from starlette.routing import Route
from starlette.responses import JSONResponse
from starlette.middleware import Middleware
from starlette.testclient import TestClient
from systemedu.student import course_numbering as n

class RuntimeTests(unittest.TestCase):
 def setUp(self):
  self.env=patch.dict(os.environ,{"STUDENT_MOLECULE_NUMBERING":n.VERSION});self.env.start()
 def tearDown(self):self.env.stop()
 def test_current_ids_keep_historical_checkpoint_identity_only(self):
  self.assertEqual(n.checkpoint_module_id(n.SLUG,"M07"),"M23")
  self.assertEqual(n.checkpoint_module_id(n.SLUG,"M23"),"M51")
  self.assertEqual(n.checkpoint_module_id("other","M23"),"M23")
  with self.assertRaises(ValueError):n.checkpoint_module_id(n.SLUG,"M90")
  self.assertNotEqual(n.summary_cache_key(n.SLUG,"M23"),f"knode:{n.SLUG}:M23:summary")
 def test_activation_requires_exact_migration_audit(self):
  e=create_engine("sqlite://")
  with self.assertRaises(RuntimeError):n.verify_numbering_activation(e)
  with e.begin() as c:
   c.execute(text("CREATE TABLE course_numbering_migrations (migration_id TEXT, mapping_sha256 TEXT)"))
   c.execute(text("INSERT INTO course_numbering_migrations VALUES (:id,:sha)"),{"id":"molecule-numbering-consecutive-v2","sha":hashlib.sha256(n._MAP_PATH.read_bytes()).hexdigest()})
  n.verify_numbering_activation(e)
  with patch.dict(os.environ,{"STUDENT_MOLECULE_NUMBERING":"legacy-v1"}):
   with self.assertRaises(RuntimeError):n.verify_numbering_activation(e)
 def test_middleware_blocks_old_scoped_requests_without_consuming_valid_body(self):
  async def endpoint(request):return JSONResponse({"body":await request.json() if request.method=="POST" else {}})
  app=Starlette(routes=[Route('/{path:path}',endpoint,methods=['GET','POST'])],middleware=[Middleware(n.CourseNumberingMiddleware)])
  with TestClient(app) as c:
   h={"X-Course-Numbering":n.VERSION}
   self.assertEqual(c.get('/api/my/projects/'+n.SLUG+'/knodes/M23').status_code,409)
   self.assertEqual(c.get('/api/my/projects/'+n.SLUG+'/knodes/M23',headers=h).status_code,200)
   self.assertEqual(c.get('/api/knodes?library_slug='+n.SLUG).status_code,409)
   data={"library_slug":n.SLUG,"module_id":"M23","message":"本人原文"}
   self.assertEqual(c.post('/api/chat',json=data).status_code,409)
   self.assertEqual(c.post('/api/chat',json=data,headers=h).json()['body'],data)
   self.assertEqual(c.post('/api/chat',json={"library_slug":"other","module_id":"M23"}).status_code,200)
   self.assertEqual(c.get('/api/my/projects/'+n.SLUG+'/files/images/immutable.webp').status_code,200)
   self.assertEqual(c.get('/api/my/projects/'+n.SLUG+'/files/knodes/M07/lesson.html').status_code,409)
   self.assertEqual(c.get('/api/my/projects').status_code,409)
   self.assertEqual(c.get('/api/user/knowledge-tree').status_code,409)
   self.assertEqual(c.get('/api/chat/sessions').status_code,409)
   self.assertEqual(c.get('/api/chat/sessions?library_slug=other').status_code,200)
   self.assertEqual(c.get('/api/my/projects',headers=h).status_code,200)
 def test_new_client_cannot_silently_read_legacy_numbered_content(self):
  with patch.dict(os.environ,{"STUDENT_MOLECULE_NUMBERING":"legacy-v1"}):
   self.assertIsNotNone(n.version_error(n.SLUG,n.VERSION))
   self.assertIsNone(n.version_error(n.SLUG,None))
 def test_websocket_guard_precedes_session_creation(self):
  source=(Path(n.__file__).parent/'chat/routes.py').read_text()
  start=source.index('async def ws_chat_stream')
  self.assertLess(source.index('mismatch = version_error',start),source.index('session_id = await _ensure_session',start))
 def test_backend_snapshot_matches_single_authority(self):
  root=Path(__file__).resolve().parents[2]
  self.assertEqual(n._MAP_PATH.read_bytes(),(root/'packages/student-web/src/lib/data/molecule-numbering-v2.json').read_bytes())

if __name__=='__main__':unittest.main()
