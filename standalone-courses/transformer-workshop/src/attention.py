"""Complete this function, then run the behavior tests."""
import numpy as np


def stable_softmax(scores, axis=-1):
    shifted = scores - np.max(scores, axis=axis, keepdims=True)
    exp = np.exp(shifted)
    return exp / np.sum(exp, axis=axis, keepdims=True)


def causal_attention(Q, K, V):
    """Q/K: (T, d_k), V: (T, d_v). Return weights(T,T), output(T,d_v)."""
    raise NotImplementedError("实现缩放、因果 mask、按行 softmax 与值聚合")
