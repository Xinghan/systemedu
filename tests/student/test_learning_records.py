import copy
import uuid

import pytest
from starlette.applications import Starlette
from starlette.testclient import TestClient


@pytest.fixture
def records(tmp_path, monkeypatch):
    monkeypatch.delenv('STUDENT_DB_URL', raising=False)
    monkeypatch.setenv('STUDENT_DB_PATH', str(tmp_path / 'records.db'))
    monkeypatch.setenv('STUDENT_JWT_SECRET', 'records-test-secret-only')
    from systemedu.student import db
    from systemedu.student.auth.jwt import create_access_token
    from systemedu.student.learning_records.routes import ROUTES
    db.reset_engine_for_tests()
    db.init_db()
    users = [db.create_user('records_' + uuid.uuid4().hex[:8], 'unused') for _ in range(2)]
    headers = [{'Authorization': 'Bearer ' + create_access_token(u.id, u.username)} for u in users]
    with TestClient(Starlette(routes=ROUTES)) as client:
        yield client, headers, db
    db.reset_engine_for_tests()


def payload(kind='classroom'):
    return dict(library_slug='write-driving-rules', module_id='M01', activity_id='reflection',
                kind=kind, content_version='1.0', expected_revision=0,
                body={'answers': [{'question_id': 'q1', 'question': '遇到未知怎么办？', 'answer': '停下核实'}]})


def scope(p):
    return {key: p[key] for key in ['library_slug', 'module_id', 'activity_id', 'kind', 'content_version']}


@pytest.mark.parametrize('kind', ['classroom', 'assignment', 'quiz', 'exam'])
def test_draft_submission_edit_and_persistent_history(records, kind):
    client, (a, _), db = records
    p = payload(kind)
    r = client.put('/api/learning/drafts', json=p, headers=a)
    assert r.status_code == 200, r.text
    assert r.json()['draft']['revision'] == 1
    p.update(expected_revision=1, request_id=str(uuid.uuid4()))
    r = client.post('/api/learning/submissions', json=p, headers=a)
    assert r.status_code == 201, r.text
    assert r.json()['submission']['grading_status'] == 'ungraded'
    submitted_id = r.json()['submission']['id']
    # 网络结果丢失后使用原 revision / request_id 重试。
    repeat = client.post('/api/learning/submissions', json=p, headers=a)
    assert repeat.status_code == 200
    assert repeat.json()['submission']['id'] == submitted_id
    p.pop('request_id'); p['expected_revision'] = 2
    p['body']['answers'][0]['answer'] = '补充测量，再判断'
    assert client.put('/api/learning/drafts', json=p, headers=a).status_code == 200
    # 丢掉 engine / 会话后仍能从数据库恢复。
    db.reset_engine_for_tests()
    result = client.get('/api/learning/records', params=scope(p), headers=a).json()
    assert result['draft']['status'] == 'draft'
    assert result['draft']['body']['answers'][0]['answer'] == '补充测量，再判断'
    assert len(result['submissions']) == 1
    assert result['submissions'][0]['body']['answers'][0]['answer'] == '停下核实'


def test_auth_user_version_and_activity_isolation(records):
    client, (a, b), _ = records
    p = payload()
    assert client.put('/api/learning/drafts', json=p).status_code == 401
    assert client.get('/api/learning/records', params=scope(p)).status_code == 401
    assert client.put('/api/learning/drafts', json=p, headers=a).status_code == 200
    assert client.get('/api/learning/records', params=scope(p), headers=b).json()['draft'] is None
    for key, other in [('content_version','2.0'), ('activity_id','different'), ('module_id','M02'), ('kind','exam'), ('library_slug','another')]:
        other_scope = {**scope(p), key: other}
        assert client.get('/api/learning/records', params=other_scope, headers=a).json()['draft'] is None
    bad = {**p, 'user_id': 'someone-else'}
    assert client.put('/api/learning/drafts', json=bad, headers=a).status_code == 400


def test_stale_device_and_submission_id_reuse_do_not_overwrite(records):
    client, (a, _), _ = records
    p = payload()
    assert client.put('/api/learning/drafts', json=p, headers=a).status_code == 200
    p['body']['answers'][0]['answer'] = '旧设备修改'
    assert client.put('/api/learning/drafts', json=p, headers=a).status_code == 409
    p['expected_revision'] = 1; p['request_id'] = str(uuid.uuid4())
    assert client.post('/api/learning/submissions', json=p, headers=a).status_code == 201
    p['body']['answers'][0]['answer'] = '冒充同一次提交'
    assert client.post('/api/learning/submissions', json=p, headers=a).status_code == 409
    result = client.get('/api/learning/records', params=scope(p), headers=a).json()
    assert result['draft']['body']['answers'][0]['answer'] == '旧设备修改'
    assert len(result['submissions']) == 1


@pytest.mark.parametrize('change', ['score','empty','duplicate','oversize','revision','kind'])
def test_reject_invalid_records(records, change):
    client, (a, _), _ = records
    p = payload(); p['request_id'] = str(uuid.uuid4())
    if change == 'score': p['score'] = 100
    if change == 'empty': p['body']['answers'][0]['answer'] = ' '
    if change == 'duplicate': p['body']['answers'] *= 2
    if change == 'oversize': p['body']['artifact'] = {'huge': 'a' * 260000}
    if change == 'revision': p['expected_revision'] = True
    if change == 'kind': p['kind'] = 'grade'
    assert client.post('/api/learning/submissions', json=p, headers=a).status_code in (400, 413)
    assert client.get('/api/learning/records', params=scope(payload()), headers=a).json()['draft'] is None


def test_concurrent_device_writes_only_one_wins(records):
    from concurrent.futures import ThreadPoolExecutor
    from systemedu.student.learning_records.routes import Save, write_record, Conflict
    client, (a, _), db = records
    p = payload()
    client.put('/api/learning/drafts', json=p, headers=a)
    from systemedu.student.auth.jwt import decode_token
    uid = decode_token(a['Authorization'][7:])['sub']
    def update(i):
        value = copy.deepcopy(p); value['expected_revision'] = 1
        value['body']['answers'][0]['answer'] = f'设备{i}'
        try:
            return write_record(uid, Save.model_validate(value), False)['draft']['revision']
        except Conflict:
            return 'conflict'
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(update, range(2)))
    assert sorted(map(str, results)) == ['2', 'conflict']


def test_migration_creates_tables_and_preserves_existing_data(tmp_path):
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    path = Path(__file__).resolve().parents[2] / 'packages/student-app/alembic/versions/047_learning_records.py'
    spec = importlib.util.spec_from_file_location('records_migration', path)
    migration = importlib.util.module_from_spec(spec); spec.loader.exec_module(migration)
    engine = sa.create_engine('sqlite:///' + str(tmp_path / 'migration.db'))
    with engine.begin() as conn:
        conn.execute(sa.text('CREATE TABLE users (id VARCHAR(36) PRIMARY KEY)'))
        conn.execute(sa.text("INSERT INTO users VALUES ('existing-user')"))
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
        assert 'learning_submissions' in sa.inspect(conn).get_table_names()
        assert conn.execute(sa.text('SELECT id FROM users')).scalar() == 'existing-user'
    engine.dispose()


def test_concurrent_duplicate_submission_is_one_snapshot(records):
    from concurrent.futures import ThreadPoolExecutor
    from systemedu.student.learning_records.routes import Submit, write_record
    from systemedu.student.auth.jwt import decode_token
    client, (a, _), _ = records
    p = payload('quiz')
    client.put('/api/learning/drafts', json=p, headers=a)
    p.update(expected_revision=1, request_id=str(uuid.uuid4()))
    uid = decode_token(a['Authorization'][7:])['sub']
    with ThreadPoolExecutor(max_workers=2) as pool:
        values = list(pool.map(lambda _: write_record(uid, Submit.model_validate(p), True), range(2)))
    assert values[0]['submission']['id'] == values[1]['submission']['id']
    assert len(client.get('/api/learning/records', params=scope(p), headers=a).json()['submissions']) == 1


def test_mission_dossier_references_preserve_original_work_and_identity(records):
    client, (a, b), db = records
    original = payload('assignment')
    original.update(module_id='M04', activity_id='final-deliverable', request_id=str(uuid.uuid4()))
    original['body']['artifact'] = {'rules': ['unknown -> stop']}
    response = client.post('/api/learning/submissions', json=original, headers=a)
    assert response.status_code == 201, response.text
    source = response.json()['submission']
    dossier = dict(library_slug='space-exploration', module_id='JOURNEY',
                   activity_id='mission-dossier', kind='assignment', content_version='1.0',
                   expected_revision=0, body={
        'answers': [{'question_id': 'goal', 'question': '观察目标', 'answer': '比较地垫纹理'}],
        'artifact': {'schema': 'space-mission-dossier/1', 'vehicleVersion': 'v1',
                     'modelVersion': '', 'archiveLocation': '', 'links': [{
                         'scope': scope(original), 'submissionId': source['id'],
                         'createdAt': source['created_at'], 'digest': 'a' * 64,
                         'owner': 'fixture-account', 'summary': '测试引用，非实物验收',
                     }]},
    })
    assert client.put('/api/learning/drafts', json=dossier, headers=a).status_code == 200
    dossier.update(expected_revision=1, request_id=str(uuid.uuid4()))
    assert client.post('/api/learning/submissions', json=dossier, headers=a).status_code == 201
    original.update(expected_revision=1, request_id=str(uuid.uuid4()))
    original['body']['artifact']['rules'] = ['unknown -> stop and inspect']
    assert client.post('/api/learning/submissions', json=original, headers=a).status_code == 201
    db.reset_engine_for_tests()
    saved = client.get('/api/learning/records', params=scope(dossier), headers=a).json()
    assert saved['submissions'][0]['body']['artifact']['links'][0]['submissionId'] == source['id']
    history = client.get('/api/learning/records', params=scope(original), headers=a).json()['submissions']
    assert len(history) == 2
    assert history[1]['body']['artifact']['rules'] == ['unknown -> stop']
    isolated = client.get('/api/learning/records', params=scope(dossier), headers=b).json()
    assert isolated == {'draft': None, 'submissions': []}


def test_failed_commit_rolls_back_draft_history_and_tutor_attempt(records, monkeypatch, caplog):
    from sqlalchemy.orm import Session
    client, (a, _), _ = records
    p = payload('quiz')
    assert client.put('/api/learning/drafts', json=p, headers=a).status_code == 200
    p.update(expected_revision=1, request_id=str(uuid.uuid4()))
    private_answer = 'private-student-answer-not-for-logs'
    p['body']['answers'][0]['answer'] = private_answer
    def fail_commit(_):
        raise RuntimeError(private_answer)
    with monkeypatch.context() as patch:
        patch.setattr(Session, 'commit', fail_commit)
        assert client.post('/api/learning/submissions', json=p, headers=a).status_code == 503
    assert private_answer not in caplog.text
    result = client.get('/api/learning/records', params=scope(p), headers=a).json()
    assert result['draft']['revision'] == 1
    assert result['draft']['body']['answers'][0]['answer'] == '停下核实'
    assert result['submissions'] == []
    assert client.post('/api/learning/submissions', json=p, headers=a).status_code == 201


def test_only_practice_submissions_enter_tutor_history(records):
    from sqlalchemy import select
    client, (a, _), db = records
    for kind in ['quiz', 'exam']:
        p = payload(kind)
        p.update(request_id=str(uuid.uuid4()))
        p['body']['client_context'] = {'practice_feedback': {'correct': True}}
        result = client.post('/api/learning/submissions', json=p, headers=a)
        assert result.status_code == 201
        assert result.json()['submission']['grading_status'] == 'ungraded'
    with db.get_session() as session:
        attempts = session.scalars(select(db.ExerciseAttempt)).all()
        assert len(attempts) == 1
        assert attempts[0].correct is True
        assert '客户端练习自检' in attempts[0].explanation_shown


def test_mission_operations_persist_timing_plan_and_account_isolation(records):
    """Task-center operations are independent drafts, never course submissions."""
    client, (a, b), db = records
    task_id = 'pick-an-observation-site:M01'
    operations = dict(library_slug='space-exploration', module_id='JOURNEY',
                      activity_id='mission-operations', kind='classroom',
                      content_version='1.0', expected_revision=0,
                      body={'answers': [], 'artifact': {
                          'schema': 'space-mission-operations/1',
                          'tasks': {task_id: {'status': 'active', 'checks': [],
                                             'evidence': '影像来源卡', 'blocker': '',
                                             'next': '检查尺度', 'due': '2026-11-01',
                                             'updatedAt': '2026-10-10T03:00:00Z'}},
                          'plan': {'weeklyMinutes': 120,
                                   'milestones': {'build': '2026-11-10'}},
                          'time': {'totals': {task_id: 20},
                                   'days': {'2026-10-10': 20},
                                   'recent': [{'id': 'work-one', 'task': task_id,
                                               'startedAt': '2026-10-10T03:00:00Z',
                                               'endedAt': '2026-10-10T03:00:20Z',
                                               'seconds': 20, 'reason': '已暂停'}]},
                          'events': [{'task': task_id, 'status': 'active',
                                      'at': '2026-10-10T03:00:00Z'}]}})
    result = client.put('/api/learning/drafts', json=operations, headers=a)
    assert result.status_code == 200, result.text
    db.reset_engine_for_tests()
    saved = client.get('/api/learning/records', params=scope(operations), headers=a).json()
    assert saved['draft']['body'] == {**operations['body'], 'client_context': {}}
    assert saved['submissions'] == []
    assert client.get('/api/learning/records', params=scope(operations), headers=b).json()['draft'] is None
    other = {**scope(operations), 'activity_id': 'mission-dossier', 'kind': 'assignment'}
    assert client.get('/api/learning/records', params=other, headers=a).json()['draft'] is None
    stale = copy.deepcopy(operations)
    stale['body']['artifact']['time']['totals'][task_id] = 999
    assert client.put('/api/learning/drafts', json=stale, headers=a).status_code == 409
    saved_again = client.get('/api/learning/records', params=scope(operations), headers=a).json()
    assert saved_again['draft']['body']['artifact']['time']['totals'][task_id] == 20
