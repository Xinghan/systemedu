import unittest
from numerical_walkthrough import audit


class NumericalAuditTest(unittest.TestCase):
    def test_derivations_against_autograd_and_finite_difference(self):
        result = audit()
        self.assertAlmostEqual(result['ce_loss'], 1.4076059644, places=9)
        self.assertAlmostEqual(sum(result['ce_gradient']), 0, places=12)
        self.assertAlmostEqual(result['token_weighted_gradient'], 8 / 3, places=12)
        self.assertEqual(result['lora_output'], [0., 3., 3.])
