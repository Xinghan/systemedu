"""Behavior tests independent of the vectorized reference implementation."""
import importlib.util
import math
import os
from pathlib import Path
import unittest
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
implementation = Path(os.environ.get("ATTENTION_IMPLEMENTATION", "src/attention.py"))
if not implementation.is_absolute():
    implementation = ROOT / implementation
spec = importlib.util.spec_from_file_location("student_attention", implementation)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
attention = module.causal_attention


def scalar_reference(Q, K, V):
    """Use scalar loops, only visiting visible positions."""
    T, d = Q.shape
    weights = np.zeros((T, T))
    output = np.zeros((T, V.shape[1]))
    for i in range(T):
        scores = [sum(float(Q[i, k] * K[j, k]) for k in range(d)) / math.sqrt(d) for j in range(i + 1)]
        terms = [math.exp(x - max(scores)) for x in scores]
        for j in range(i + 1):
            weights[i, j] = terms[j] / sum(terms)
            for feature in range(V.shape[1]):
                output[i, feature] += weights[i, j] * V[j, feature]
    return weights, output


class AttentionTests(unittest.TestCase):
    def inputs(self, T=5, dk=3, dv=2, seed=9182):
        rng = np.random.default_rng(seed)
        return rng.normal(size=(T, dk)), rng.normal(size=(T, dk)), rng.normal(size=(T, dv))

    def test_shape_and_different_value_dimension(self):
        w, y = attention(*self.inputs(T=7, dk=2, dv=5))
        self.assertEqual(np.asarray(w).shape, (7, 7))
        self.assertEqual(np.asarray(y).shape, (7, 5))

    def test_single_token_reads_itself(self):
        Q, K, V = self.inputs(T=1)
        w, y = attention(Q, K, V)
        np.testing.assert_allclose(w, [[1.]])
        np.testing.assert_allclose(y, V)

    def test_matches_independent_scalar_definition(self):
        for seed in [3, 73, 1001, 8462]:
            with self.subTest(seed=seed):
                data = self.inputs(seed=seed)
                actual, expected = attention(*data), scalar_reference(*data)
                for a, b in zip(actual, expected):
                    np.testing.assert_allclose(a, b, rtol=1e-5, atol=1e-6)

    def test_rows_form_probabilities(self):
        w, _ = attention(*self.inputs())
        self.assertTrue(np.all(np.asarray(w) >= 0))
        np.testing.assert_allclose(np.sum(w, axis=-1), np.ones(5), atol=1e-6)

    def test_no_weight_on_future(self):
        w, _ = attention(*self.inputs())
        np.testing.assert_allclose(np.triu(w, k=1), 0, atol=1e-7)

    def test_future_perturbation_preserves_prefix(self):
        Q, K, V = self.inputs()
        _, before = attention(Q.copy(), K.copy(), V.copy())
        Q[2:] += 8
        K[2:] -= 7
        V[2:] += 10
        _, after = attention(Q, K, V)
        np.testing.assert_allclose(before[:2], after[:2], rtol=1e-5, atol=1e-6)

    def test_extreme_scores_stay_finite(self):
        Q, K, V = self.inputs(T=4, dk=2)
        Q *= 100
        K *= 100
        w, y = attention(Q, K, V)
        self.assertTrue(np.all(np.isfinite(w)))
        self.assertTrue(np.all(np.isfinite(y)))
        np.testing.assert_allclose(np.sum(w, axis=-1), 1, atol=1e-6)

    def test_equal_scores_average_visible_values(self):
        Q, K = np.zeros((4, 2)), np.ones((4, 2))
        V = np.array([[1., 3.], [5., 1.], [-2., 4.], [0., -1.]])
        _, y = attention(Q, K, V)
        for i in range(4):
            np.testing.assert_allclose(y[i], V[:i + 1].mean(axis=0), atol=1e-6)


if __name__ == "__main__":
    unittest.main()
