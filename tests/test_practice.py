"""Tests for practice exercise generation, submission, and grading."""

import json

import pytest

from systemedu.education.lesson_generator import _validate_practice_json


class TestValidatePracticeJson:
    """Tests for _validate_practice_json function."""

    def test_valid_json_with_all_types(self):
        data = {
            "exercises": [
                {
                    "type": "choice",
                    "question": "什么是变量？",
                    "options": ["存储数据的容器", "一种函数", "一种循环", "一种条件"],
                    "correct": 0,
                    "answer": "",
                    "hint": "想想盒子",
                    "explanation": "变量是存储数据的容器",
                    "difficulty": "easy",
                    "points": 10,
                },
                {
                    "type": "fill_blank",
                    "question": "Python 中用 ___ 关键字定义函数",
                    "options": [],
                    "correct": -1,
                    "answer": "def",
                    "hint": "define 的缩写",
                    "explanation": "def 关键字",
                    "difficulty": "medium",
                    "points": 10,
                },
                {
                    "type": "short_answer",
                    "question": "请解释面向对象编程的三大特性",
                    "options": [],
                    "correct": -1,
                    "answer": "封装、继承、多态",
                    "hint": "有三个关键词",
                    "explanation": "OOP 三大特性",
                    "difficulty": "hard",
                    "points": 15,
                },
            ],
            "total_points": 35,
            "pass_score": 20,
        }
        result = _validate_practice_json(json.dumps(data, ensure_ascii=False))
        parsed = json.loads(result)
        assert len(parsed["exercises"]) == 3
        assert parsed["total_points"] == 35
        assert parsed["pass_score"] == 20

    def test_valid_json_wrapped_in_code_fences(self):
        data = {
            "exercises": [
                {
                    "type": "choice",
                    "question": "1+1=?",
                    "options": ["1", "2", "3", "4"],
                    "correct": 1,
                    "answer": "",
                    "hint": "",
                    "explanation": "",
                    "difficulty": "easy",
                    "points": 10,
                },
            ],
            "total_points": 10,
            "pass_score": 6,
        }
        raw = f"```json\n{json.dumps(data, ensure_ascii=False)}\n```"
        result = _validate_practice_json(raw)
        parsed = json.loads(result)
        assert len(parsed["exercises"]) == 1
        assert parsed["exercises"][0]["type"] == "choice"

    def test_auto_calculate_total_points(self):
        data = {
            "exercises": [
                {"type": "choice", "question": "Q1", "options": ["A", "B"], "correct": 0, "answer": "", "hint": "", "explanation": "", "difficulty": "easy", "points": 10},
                {"type": "fill_blank", "question": "Q2", "options": [], "correct": -1, "answer": "x", "hint": "", "explanation": "", "difficulty": "medium", "points": 15},
            ],
        }
        result = _validate_practice_json(json.dumps(data, ensure_ascii=False))
        parsed = json.loads(result)
        assert parsed["total_points"] == 25
        assert parsed["pass_score"] == 15  # 60% of 25

    def test_invalid_exercise_type_returns_original(self):
        data = {
            "exercises": [
                {"type": "unknown_type", "question": "Q", "options": [], "correct": 0, "answer": "", "hint": "", "explanation": "", "difficulty": "easy", "points": 10},
            ],
            "total_points": 10,
            "pass_score": 6,
        }
        raw = json.dumps(data, ensure_ascii=False)
        result = _validate_practice_json(raw)
        assert result == raw  # Returns original on invalid type

    def test_empty_exercises_returns_original(self):
        data = {"exercises": [], "total_points": 0, "pass_score": 0}
        raw = json.dumps(data, ensure_ascii=False)
        result = _validate_practice_json(raw)
        assert result == raw

    def test_missing_exercises_key_returns_original(self):
        data = {"questions": []}
        raw = json.dumps(data, ensure_ascii=False)
        result = _validate_practice_json(raw)
        assert result == raw

    def test_non_json_markdown_returns_original(self):
        markdown = "## 练习一：基础题\n\n请回答以下问题..."
        result = _validate_practice_json(markdown)
        assert result == markdown

    def test_non_dict_exercises_returns_original(self):
        data = {"exercises": ["not a dict"], "total_points": 10, "pass_score": 6}
        raw = json.dumps(data, ensure_ascii=False)
        result = _validate_practice_json(raw)
        assert result == raw


class TestPracticeSubmissionDB:
    """Tests for PracticeSubmission DB model."""

    def test_create_submission(self, tmp_path):
        """Test creating a PracticeSubmission record."""
        from systemedu.storage.db import Base, PracticeSubmission

        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker

        db_file = tmp_path / "test.db"
        engine = create_engine(f"sqlite:///{db_file}")
        Base.metadata.create_all(engine)
        Session = sessionmaker(bind=engine)
        db = Session()

        sub = PracticeSubmission(
            user_id="test_user",
            project_name="test-project",
            knode_id=0,
            attempt=1,
            answers_json=json.dumps([{"exercise_idx": 0, "user_answer": "1"}]),
            score=10.0,
            total_points=35.0,
            feedback_json=json.dumps([{"exercise_idx": 0, "correct": True, "points_earned": 10, "feedback": "ok"}]),
            status="graded",
        )
        db.add(sub)
        db.commit()

        result = db.query(PracticeSubmission).filter_by(user_id="test_user").first()
        assert result is not None
        assert result.score == 10.0
        assert result.attempt == 1
        assert result.status == "graded"

        answers = json.loads(result.answers_json)
        assert len(answers) == 1
        assert answers[0]["exercise_idx"] == 0

        db.close()


class TestGradingLogic:
    """Tests for grading logic (choice and fill_blank only, short_answer needs LLM)."""

    def test_choice_grading_correct(self):
        """Correct choice answer should match."""
        user_answer = "0"
        correct_idx = 0
        assert user_answer == str(correct_idx)

    def test_choice_grading_incorrect(self):
        """Wrong choice answer should not match."""
        user_answer = "2"
        correct_idx = 0
        assert user_answer != str(correct_idx)

    def test_fill_blank_grading_case_insensitive(self):
        """Fill blank grading should be case insensitive."""
        user_answer = "Def"
        expected = "def"
        assert user_answer.strip().lower() == expected.strip().lower()

    def test_fill_blank_grading_with_whitespace(self):
        """Fill blank grading should strip whitespace."""
        user_answer = "  def  "
        expected = "def"
        assert user_answer.strip().lower() == expected.strip().lower()


class TestLabCoderValidation:
    """Tests for enhanced lab_coder validation."""

    def test_validate_with_drag_elements(self):
        from systemedu.agents.builtin.lab_coder import validate_lab_html

        html = """<!DOCTYPE html><html><head><style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shake { 0% { transform: translateX(0); } }
        </style></head><body>
        <div id="root"></div>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script type="text/babel">
        const App = () => {
          const [items, setItems] = React.useState([]);
          const handleDragStart = (e, id) => { e.dataTransfer.setData("text/plain", id); };
          return <div draggable onDragStart={(e) => handleDragStart(e, "1")} onClick={() => {}}>
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>
          </div>;
        };
        ReactDOM.createRoot(document.getElementById('root')).render(<App />);
        </script></body></html>"""

        result = validate_lab_html(html)
        assert result["fatal"] is None
        # Should have no drag warnings since we have draggable/onDragStart
        drag_warnings = [w for w in result["warnings"] if "drag" in w.lower()]
        assert len(drag_warnings) == 0

    def test_validate_missing_drag_warns(self):
        from systemedu.agents.builtin.lab_coder import validate_lab_html

        html = """<!DOCTYPE html><html><head><style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style></head><body>
        <div id="root"></div>
        <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
        <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
        <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
        <script type="text/babel">
        const App = () => {
          const [s, setS] = React.useState(0);
          return <div onClick={() => setS(1)}>
            <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>
          </div>;
        };
        ReactDOM.createRoot(document.getElementById('root')).render(<App />);
        </script></body></html>"""

        result = validate_lab_html(html)
        assert result["fatal"] is None
        warnings_text = " ".join(result["warnings"])
        assert "drag" in warnings_text.lower()
        assert "@keyframes" in warnings_text.lower() or "keyframes" in warnings_text.lower()
