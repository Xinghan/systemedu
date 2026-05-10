"""Tests for StudentFactDAO (spec 014 T2.1)."""

from __future__ import annotations

import pytest
import sqlalchemy as sa
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from systemedu.core.storage.db import Base, StudentFact
from systemedu.core.tutor.memory import StudentFactDAO


@pytest.fixture
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def dao(db):
    return StudentFactDAO(db)


class TestInsert:
    def test_current_fact_has_no_valid_to(self, dao, db):
        fact = dao.insert(user_id="u1", category="knowledge", content="懂摩擦力")
        db.commit()
        assert fact.id is not None
        assert fact.valid_to is None
        assert fact.fact_metadata == {}
        assert fact.confidence == 0.7  # default

    def test_insert_with_metadata(self, dao, db):
        fact = dao.insert(
            user_id="u1",
            category="knowledge",
            content="理解向量",
            knode_id="k5",
            fact_metadata={"mastery_level": "apply", "evidence_msg_ids": [1, 2]},
        )
        db.commit()
        assert fact.fact_metadata["mastery_level"] == "apply"
        assert fact.fact_metadata["evidence_msg_ids"] == [1, 2]


class TestGetCurrent:
    def test_returns_current_fact(self, dao, db):
        dao.insert(user_id="u1", knode_id="k1", category="knowledge", content="当前事实")
        db.commit()
        found = dao.get_current(user_id="u1", knode_id="k1", category="knowledge")
        assert found is not None
        assert found.content == "当前事实"

    def test_returns_none_when_absent(self, dao):
        assert dao.get_current(user_id="u1", knode_id="k1", category="knowledge") is None

    def test_ignores_superseded_facts(self, dao, db):
        """If a fact has valid_to set, get_current must skip it."""
        dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge",
            content="old", confidence=0.6,
        )
        db.commit()
        new = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge",
            content="new", confidence=0.9,
        )
        db.commit()

        found = dao.get_current(user_id="u1", knode_id="k1", category="knowledge")
        assert found.id == new.id
        assert found.content == "new"


class TestInsertWithSupersede:
    def test_first_insert_no_old_fact(self, dao, db):
        """Initial insert with supersede=True works even when there's no old fact."""
        new = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge", content="first",
        )
        db.commit()
        assert new.valid_to is None
        assert new.superseded_by is None

    def test_old_fact_retired_on_supersede(self, dao, db):
        old = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge", content="old",
        )
        db.commit()
        new = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge", content="new",
        )
        db.commit()

        db.refresh(old)
        assert old.valid_to is not None
        assert old.superseded_by == new.id
        assert new.valid_to is None

    def test_supersede_false_keeps_old_current(self, dao, db):
        """supersede=False lets two current facts coexist."""
        a = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="interest", content="A",
        )
        db.commit()
        b = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="interest", content="B",
            supersede=False,
        )
        db.commit()

        db.refresh(a)
        assert a.valid_to is None
        assert b.valid_to is None

    def test_supersede_scoped_by_triple(self, dao, db):
        """Inserting a fact in one category must not retire facts in another."""
        knowledge = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge", content="理解",
        )
        db.commit()
        dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="struggle", content="卡在坡道",
        )
        db.commit()

        db.refresh(knowledge)
        assert knowledge.valid_to is None

    def test_supersede_scoped_by_knode(self, dao, db):
        """Same user + category but different knode must not cross-retire."""
        k1 = dao.insert_with_supersede(
            user_id="u1", knode_id="k1", category="knowledge", content="k1 fact",
        )
        db.commit()
        dao.insert_with_supersede(
            user_id="u1", knode_id="k2", category="knowledge", content="k2 fact",
        )
        db.commit()

        db.refresh(k1)
        assert k1.valid_to is None


class TestListByUser:
    def test_returns_current_only_by_default(self, dao, db):
        dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                  category="knowledge", content="v1")
        db.commit()
        dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                  category="knowledge", content="v2")
        db.commit()

        facts = dao.list_by_user("u1")
        assert len(facts) == 1
        assert facts[0].content == "v2"

    def test_current_only_false_returns_all(self, dao, db):
        dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                  category="knowledge", content="v1")
        db.commit()
        dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                  category="knowledge", content="v2")
        db.commit()

        all_facts = dao.list_by_user("u1", current_only=False)
        assert len(all_facts) == 2

    def test_project_filter(self, dao, db):
        dao.insert(user_id="u1", category="interest", content="A",
                   project_name="mars-rover")
        dao.insert(user_id="u1", category="interest", content="B",
                   project_name="train-ai")
        db.commit()

        mars_only = dao.list_by_user("u1", project_name="mars-rover")
        assert len(mars_only) == 1
        assert mars_only[0].content == "A"

    def test_category_filter(self, dao, db):
        dao.insert(user_id="u1", category="knowledge", content="K")
        dao.insert(user_id="u1", category="struggle", content="S")
        db.commit()

        kn = dao.list_by_user("u1", category="knowledge")
        assert len(kn) == 1
        assert kn[0].content == "K"


class TestListByKnode:
    def test_all_categories_for_one_knode(self, dao, db):
        dao.insert(user_id="u1", knode_id="k1", category="knowledge", content="K")
        dao.insert(user_id="u1", knode_id="k1", category="struggle", content="S")
        dao.insert(user_id="u1", knode_id="k2", category="knowledge", content="other")
        db.commit()

        facts = dao.list_by_knode(user_id="u1", knode_id="k1")
        assert len(facts) == 2
        assert {f.category for f in facts} == {"knowledge", "struggle"}


class TestSupersedeChain:
    def test_walks_chain_forward(self, dao, db):
        v1 = dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                        category="knowledge", content="v1")
        db.commit()
        v2 = dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                        category="knowledge", content="v2")
        db.commit()
        v3 = dao.insert_with_supersede(user_id="u1", knode_id="k1",
                                        category="knowledge", content="v3")
        db.commit()

        chain = dao.get_supersede_chain(v1.id)
        assert [f.content for f in chain] == ["v1", "v2", "v3"]

    def test_chain_from_current_fact_is_length_one(self, dao, db):
        v1 = dao.insert(user_id="u1", category="interest", content="only")
        db.commit()
        chain = dao.get_supersede_chain(v1.id)
        assert len(chain) == 1

    def test_chain_missing_id_returns_empty(self, dao):
        assert dao.get_supersede_chain(99999) == []


class TestIndexUsage:
    """SQLite EXPLAIN QUERY PLAN confirms composite indexes are used."""

    def test_ix_sf_user_knode_category_used(self, db):
        plan = db.execute(sa.text(
            "EXPLAIN QUERY PLAN "
            "SELECT * FROM student_facts "
            "WHERE user_id='u1' AND knode_id='k1' AND category='knowledge'"
        )).fetchall()
        joined = " ".join(str(row[-1]) for row in plan).lower()
        assert "ix_sf_user_knode_category" in joined

    def test_ix_sf_user_current_used(self, db):
        plan = db.execute(sa.text(
            "EXPLAIN QUERY PLAN "
            "SELECT * FROM student_facts WHERE user_id='u1' AND valid_to IS NULL"
        )).fetchall()
        joined = " ".join(str(row[-1]) for row in plan).lower()
        # SQLite may pick either user_id or the composite; both are valid
        assert "ix_sf_user" in joined
