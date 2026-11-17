"""Original reference implementation for comparison after the exercise."""
import numpy as np


def causal_attention(Q, K, V):
    T, d_k = Q.shape
    scores = (Q @ K.T) / np.sqrt(d_k)
    scores = np.where(np.tril(np.ones((T, T), dtype=bool)), scores, -np.inf)
    exp = np.exp(scores - np.max(scores, axis=-1, keepdims=True))
    weights = exp / np.sum(exp, axis=-1, keepdims=True)
    return weights, weights @ V
