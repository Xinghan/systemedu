"""CPU companion to the web calculations. Run: python numerical_walkthrough.py.

Small numerical examples, not GPU measurements or a replacement quantization kernel.
"""
import json
import torch
import torch.nn.functional as F

NF4 = torch.tensor([
    -1., -.6961928, -.52507305, -.39491749, -.28444138, -.18477343,
    -.09105004, 0., .0795803, .1609302, .2461123, .33791524,
    .44070983, .562617, .72295684, 1.,
], dtype=torch.float64)


def nf4_reference(weights):
    """One absmax-normalized block, nearest-code lookup, no bit packing."""
    weights = torch.as_tensor(weights, dtype=torch.float64)
    scale = weights.abs().max().clamp_min(1e-12)
    codes = (weights[:, None] / scale - NF4[None]).abs().argmin(-1)
    restored = NF4[codes] * scale
    return scale, codes, restored


def audit():
    z = torch.tensor([2., 1., 0.], dtype=torch.float64, requires_grad=True)
    loss = F.cross_entropy(z[None], torch.tensor([1]))
    loss.backward()
    expected = z.detach().softmax(-1) - torch.tensor([0., 1., 0.])
    torch.testing.assert_close(z.grad, expected)
    eps = 1e-5
    finite_diff = []
    for direction in torch.eye(3, dtype=torch.float64):
        plus = F.cross_entropy((z.detach() + eps * direction)[None], torch.tensor([1]))
        minus = F.cross_entropy((z.detach() - eps * direction)[None], torch.tensor([1]))
        finite_diff.append((plus - minus) / (2 * eps))
    torch.testing.assert_close(z.grad, torch.stack(finite_diff))

    # Compare matrix calculus with autograd for a nonzero rank-2 adapter.
    A = torch.tensor([[1., 0., 1.], [0., 1., -1.]], dtype=torch.float64, requires_grad=True)
    B = torch.tensor([[1., 0.], [2., 1.], [0., 1.]], dtype=torch.float64, requires_grad=True)
    x = torch.tensor([1., 2., -1.], dtype=torch.float64)
    upstream = torch.tensor([.2, -.3, .5], dtype=torch.float64)
    scale = 2.0 / 2
    y = scale * B @ A @ x
    torch.testing.assert_close(y, scale * (B @ (A @ x)))
    (upstream @ y).backward()
    torch.testing.assert_close(B.grad, scale * torch.outer(upstream, A.detach() @ x))
    torch.testing.assert_close(A.grad, scale * torch.outer(B.detach().T @ upstream, x))

    # First A gradient is zero, second is nonzero under standard asymmetric init.
    a = torch.tensor(.5, dtype=torch.float64, requires_grad=True)
    b = torch.tensor(0., dtype=torch.float64, requires_grad=True)
    opt = torch.optim.SGD([a, b], lr=.1)
    gradients = []
    for _ in range(2):
        opt.zero_grad(set_to_none=True)
        (.5 * (b * a * 2 - 1).square()).backward()
        gradients.append([a.grad.item(), b.grad.item()])
        opt.step()
    torch.testing.assert_close(torch.tensor(gradients), torch.tensor([[0., -1.], [-.18, -.9]]))

    # A linear scalar objective makes token-normalization errors easy to expose.
    w = torch.tensor(1., dtype=torch.float64, requires_grad=True)
    for coefficients in [torch.ones(2), torch.full((10,), 3.)]:
        (w * coefficients.sum() / 12).backward()
    torch.testing.assert_close(w.grad, torch.tensor(8 / 3, dtype=torch.float64))

    weights = [-.7, -.3, -.1, 0., .2, .4, .6, 1.]
    quant_scale, codes, restored = nf4_reference(weights)
    assert codes[3].item() == 7 and restored[3].item() == 0
    _, outlier_codes, outlier_restored = nf4_reference(weights[:-1] + [6.])
    assert outlier_codes[4].item() == 7 and outlier_restored[4].item() == 0
    return {
        "ce_loss": loss.item(), "ce_gradient": z.grad.tolist(),
        "finite_difference": [v.item() for v in finite_diff],
        "lora_output": y.detach().tolist(), "lora_dA": A.grad.tolist(), "lora_dB": B.grad.tolist(),
        "lora_two_step_gradients": gradients, "token_weighted_gradient": w.grad.item(),
        "nf4_scale": quant_scale.item(), "nf4_codes": codes.tolist(), "nf4_restored": restored.tolist(),
        "scope": "CPU arithmetic only; no pretrained model or GPU benchmark",
    }


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2, ensure_ascii=False))
