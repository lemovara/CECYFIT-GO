import unittest
from build_usda_foundation import extract_foods, build_sql


def row(nutrient_id, amount, unit='g'):
    return {'nutrient': {'id': nutrient_id, 'unitName': unit}, 'amount': amount}


class BuildUsdaFoundationTest(unittest.TestCase):
    def test_preserves_reported_zero_and_rejects_missing_or_ambiguous_values(self):
        values = [row(1003, 1), row(1004, 0), row(1005, 2), row(1079, 3), row(2047, 25, 'kcal')]
        data = {'FoundationFoods': [
            {'fdcId': 1, 'description': "Food's name", 'foodNutrients': values},
            {'fdcId': 2, 'description': 'Missing', 'foodNutrients': values[:-1]},
            {'fdcId': 3, 'description': 'Ambiguous', 'foodNutrients': values + [row(1003, 4)]},
            {'fdcId': 4, 'description': 'Wrong units', 'foodNutrients': values[:-1] + [row(2047, 25, 'kJ')]},
        ]}
        result = extract_foods(data)
        self.assertEqual([item['fdc_id'] for item in result], [1])
        self.assertEqual(result[0]['fat'], 0)
        sql = build_sql(result, 'testhash')
        self.assertIn("Food''s name", sql)
        self.assertIn('on conflict (id) do nothing', sql)
        self.assertIn('add column if not exists source_name', sql)
        self.assertIn('CC0 1.0', sql)


if __name__ == '__main__': unittest.main()
