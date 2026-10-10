import json, sys, unittest
from pathlib import Path
from sqlalchemy import create_engine, MetaData, Table, Column, String, Text, UniqueConstraint, select, insert, update
sys.path.insert(0,str(Path(__file__).resolve().parent))
import migrate_student_numbering as m
class DBTests(unittest.TestCase):
 def setUp(self):
  self.e=create_engine("sqlite://");meta=MetaData()
  self.t=Table("chat_sessions",meta,Column("id",String,primary_key=True),Column("library_slug",String),Column("module_id",String),Column("title",Text),UniqueConstraint("library_slug","module_id","title"))
  meta.create_all(self.e)
  with self.e.begin() as c:c.execute(insert(self.t),[{"id":"a","library_slug":m.SLUG,"module_id":"M23","title":"本人原文 M23 不改"},{"id":"b","library_slug":m.SLUG,"module_id":"M51","title":"本人原文 M23 不改"},{"id":"c","library_slug":"other","module_id":"M23","title":"other"}])
 def rows(self):
  with self.e.connect() as c:return list(c.execute(select(self.t).order_by(self.t.c.id)))
 def test_dry_run_no_writes(self):
  before=self.rows();self.assertEqual(m.migrate(self.e)["changed"],2);self.assertEqual(before,self.rows())
 def test_collision_safe_and_other_project_untouched(self):
  before=self.rows();r=m.migrate(self.e,True);after=self.rows()
  self.assertEqual(r["status"],"applied");self.assertEqual([r.module_id for r in after],["M07","M23","M23"])
  self.assertEqual([r.title for r in before],[r.title for r in after])
  self.assertEqual(m.migrate(self.e,True)["status"],"already-applied")
  m.rollback(self.e);self.assertEqual(before,self.rows())
 def test_unknown_id_aborts_without_changes(self):
  with self.e.begin() as c:c.execute(update(self.t).where(self.t.c.id=="b").values(module_id="M999"))
  before=self.rows()
  with self.assertRaises(ValueError):m.migrate(self.e,True)
  self.assertEqual(before,self.rows())
 def test_rollback_rejects_drift(self):
  m.migrate(self.e,True)
  with self.e.begin() as c:c.execute(update(self.t).where(self.t.c.id=="a").values(module_id="M08"))
  before=self.rows()
  with self.assertRaises(ValueError):m.rollback(self.e)
  self.assertEqual(before,self.rows())
 def test_system_queue_references_change_but_authored_text_does_not(self):
  meta=MetaData();q=Table('pending_growth',meta,Column('id',String,primary_key=True),Column('source',String),Column('content',Text));meta.create_all(self.e)
  value='knode:'+m.SLUG+':M23'
  with self.e.begin() as c:c.execute(insert(q),[{'id':'q1','source':'complete_knode','content':value},{'id':'q2','source':'question','content':value}])
  m.migrate(self.e,True)
  with self.e.connect() as c:values=list(c.execute(select(q.c.content).order_by(q.c.id)).scalars())
  self.assertEqual(values,['knode:'+m.SLUG+':M07',value])
  m.rollback(self.e)
  with self.e.connect() as c:self.assertEqual(list(c.execute(select(q.c.content)).scalars()),[value,value])
if __name__=="__main__":unittest.main()
