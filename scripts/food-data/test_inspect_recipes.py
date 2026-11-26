import unittest
from inspect_recipes import inspect


class InspectRecipesTest(unittest.TestCase):
    def test_filter_deduplicate_and_flag_incomplete(self):
        rows = [
            {'Nombre': 'Tacos', 'País': 'México', 'Ingredientes': 'Sal al gusto', 'Pasos': 'Preparar', 'URL': 'https://example.test/1'},
            {'Nombre': 'Tacos', 'País': 'México', 'Ingredientes': 'Sal', 'Pasos': 'Preparar', 'URL': 'https://example.test/1'},
            {'Nombre': 'Otro', 'País': 'Perú'},
            {'Nombre': 'Sopa', 'País': 'MEX'},
        ]
        report = inspect(rows, mexican_only=True)
        self.assertEqual(report['counts']['duplicates'], 1)
        self.assertEqual(report['counts']['excluded_country'], 1)
        self.assertEqual(report['counts']['needs_review'], 2)
        self.assertEqual(report['counts']['indeterminate_quantity'], 1)
        self.assertEqual(report['counts']['missing_ingredients'], 1)
        self.assertEqual(report['imported'], 0)


if __name__ == '__main__':
    unittest.main()
