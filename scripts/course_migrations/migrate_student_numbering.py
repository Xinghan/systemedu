"""Transactional association migration. Dry-run by default; learner text is never rewritten."""
from __future__ import annotations
import argparse, hashlib, json
from pathlib import Path
from sqlalchemy import MetaData, Table, Column, String, Text, inspect, select, update, insert, delete, text, create_engine
from molecule_numbering import ID_MAP, SLUG, VERSION, MAP_FILE

# Exhaustive reviewed list; unfamiliar project-scoped module columns fail closed.
TABLES={
 "last_visited":("library_slug","last_module_id"),
 "user_knode_complete":("project_slug","knode_id"),
 "user_badges":("project_slug","knode_id"),
 "user_knode_badge_drops":("project_slug","knode_id"),
 "knowledge_drills":("library_slug","module_id"),
 "chat_sessions":("library_slug","module_id"),
 "chat_messages":("library_slug","module_id"),
 "notes":("library_slug","module_id"),
 "assignment_submissions":("library_slug","module_id"),
 "exercise_attempts":("library_slug","module_id"),
 "student_facts":("library_slug","module_id"),
}
MIGRATION="molecule-numbering-consecutive-v2"
AUDIT="course_numbering_migrations"
def map_hash():return hashlib.sha256(MAP_FILE.read_bytes()).hexdigest()
def _audit_table(meta):
 return Table(AUDIT,meta,Column("migration_id",String(128),primary_key=True),Column("mapping_sha256",String(64),nullable=False),Column("rows_json",Text,nullable=False))
def _column(row):return "content" if row["table"]=="pending_growth" else TABLES[row["table"]][1]
def _condition(table,row,value):
 if row["table"]=="pending_growth":return (table.c.id==row["id"]) & (table.c.source=="complete_knode") & (table.c.content==value)
 scope,col=TABLES[row["table"]]
 return (table.c.id==row["id"]) & (table.c[scope]==SLUG) & (table.c[col]==value)
def collect(conn):
 inspector=inspect(conn);names=set(inspector.get_table_names());meta=MetaData();rows=[];tables={}
 for name in names-{AUDIT}:
  cols={c["name"] for c in inspector.get_columns(name)}
  if cols&{"module_id","knode_id","last_module_id"} and cols&{"library_slug","project_slug"} and name not in TABLES:raise ValueError("Unreviewed module association table: "+name)
 for name,(scope,column) in TABLES.items():
  if name not in names:continue
  table=Table(name,meta,autoload_with=conn);tables[name]=table
  if not {"id",scope,column}<=set(table.c.keys()):raise ValueError("Unexpected table schema: "+name)
  pk=[x.name for x in table.primary_key.columns]
  if pk!=["id"]:raise ValueError("Unreviewed primary key: "+name)
  for row in conn.execute(select(table.c.id,table.c[column]).where(table.c[scope]==SLUG)):
   old=row[1]
   if old in {None,""}:continue
   if old not in ID_MAP:raise ValueError("Unknown legacy ID in "+name+": "+str(old))
   if old!=ID_MAP[old]:rows.append({"table":name,"id":row[0],"old":old,"new":ID_MAP[old]})
 # Machine-generated queue references are associations, not learner-authored prose.
 if "pending_growth" in names:
  t=Table("pending_growth",meta,autoload_with=conn);tables[t.name]=t;prefix="knode:"+SLUG+":"
  if [x.name for x in t.primary_key.columns]!=["id"]:raise ValueError("Unreviewed pending_growth primary key")
  for row in conn.execute(select(t.c.id,t.c.content).where(t.c.source=="complete_knode",t.c.content.startswith(prefix))):
   old_id=row[1][len(prefix):]
   if old_id not in ID_MAP:raise ValueError("Unknown queued legacy knode")
   new=prefix+ID_MAP[old_id]
   if new!=row[1]:rows.append({"table":t.name,"id":row[0],"old":row[1],"new":new})
 return tables,rows
def migrate(engine,apply=False):
 with engine.begin() as conn:
  # Operator must pause application writes. A PostgreSQL advisory transaction lock
  # also prevents two migration commands, but does not pretend to lock normal writers.
  if conn.dialect.name=="postgresql":conn.execute(text("SELECT pg_advisory_xact_lock(230720260912)"))
  names=set(inspect(conn).get_table_names());meta=MetaData()
  if AUDIT in names:
   audit=Table(AUDIT,meta,autoload_with=conn)
   previous=conn.execute(select(audit).where(audit.c.migration_id==MIGRATION)).mappings().first()
   if previous:
    if previous["mapping_sha256"]!=map_hash():raise ValueError("Mapping differs from applied audit")
    return {"status":"already-applied","changed":len(json.loads(previous["rows_json"]))}
  tables,rows=collect(conn)
  report={"status":"dry-run","changed":len(rows),"by_table":{name:sum(r["table"]==name for r in rows) for name in tables},"project":SLUG}
  if not apply:return report
  # Two phases prevent transient UNIQUE conflicts when M51→M23 and M23→M07 coexist.
  for r in rows:
   t=tables[r["table"]];col=_column(r);temp="__rn2__"+r["old"]
   count=conn.execute(update(t).where(_condition(t,r,r["old"])).values({col:temp})).rowcount
   if count!=1:raise ValueError("Concurrent change; transaction aborted")
  for r in rows:
   t=tables[r["table"]];col=_column(r)
   count=conn.execute(update(t).where(_condition(t,r,"__rn2__"+r["old"])).values({col:r["new"]})).rowcount
   if count!=1:raise ValueError("Temporary ID lost")
  audit=_audit_table(MetaData());audit.create(conn,checkfirst=True)
  conn.execute(insert(audit).values(migration_id=MIGRATION,mapping_sha256=map_hash(),rows_json=json.dumps(rows)))
  return {**report,"status":"applied"}
def rollback(engine):
 with engine.begin() as conn:
  audit=Table(AUDIT,MetaData(),autoload_with=conn)
  previous=conn.execute(select(audit).where(audit.c.migration_id==MIGRATION)).mappings().one()
  if previous["mapping_sha256"]!=map_hash():raise ValueError("Wrong mapping")
  rows=json.loads(previous["rows_json"]);tables={n:Table(n,MetaData(),autoload_with=conn) for n in {r["table"] for r in rows}}
  # Exact audit rollback only. Caller must retain write freeze; row drift aborts.
  for r in rows:
   t=tables[r["table"]];col=_column(r)
   actual=conn.execute(select(t.c[col]).where(_condition(t,r,r["new"]))).scalar_one_or_none()
   if actual!=r["new"]:raise ValueError("Record changed since migration; cannot safely roll back")
  for r in rows:
   t=tables[r["table"]];col=_column(r);conn.execute(update(t).where(t.c.id==r["id"]).values({col:"__rb2__"+r["old"]}))
  for r in rows:
   t=tables[r["table"]];col=_column(r);conn.execute(update(t).where(t.c.id==r["id"]).values({col:r["old"]}))
  conn.execute(delete(audit).where(audit.c.migration_id==MIGRATION))
  return {"status":"rolled-back","changed":len(rows)}
if __name__=="__main__":
 p=argparse.ArgumentParser();p.add_argument("--apply",action="store_true");p.add_argument("--rollback",action="store_true");p.add_argument("--writes-paused",action="store_true");a=p.parse_args()
 if (a.apply or a.rollback) and not a.writes_paused:p.error("Write freeze and external DB backup are required")
 if a.apply and a.rollback:p.error("Choose apply OR rollback")
 from systemedu.student.db import _ensure_engine
 result=rollback(_ensure_engine()) if a.rollback else migrate(_ensure_engine(),a.apply)
 print(json.dumps(result,ensure_ascii=False))
