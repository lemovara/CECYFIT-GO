import unittest
from decimal import Decimal
from build_fndds_mexican import NAMES, extract, build_sql


def food():
    return {'fdcId': 2708515, 'description': 'Taco, corn tortilla, beef, cheese', 'foodNutrients': [
        {'nutrient': {'id': ident, 'unitName': unit}, 'amount': value}
        for ident, unit, value in [(1008, 'kcal', 249), (1003, 'g', 15.5), (1005, 'g', 15.3), (1004, 'g', 13.9), (1079, 'g', 2.1)]
    ]}


class FnddsTest(unittest.TestCase):
    def test_reads_complete_values_and_preserves_description(self):
        row = extract({'SurveyFoods': [food()]})[0]
        self.assertEqual(row['name'], 'Taco de tortilla de maíz con res y queso')
        self.assertEqual(row['original'], 'Taco, corn tortilla, beef, cheese')
        self.assertEqual(row['kcal'], Decimal('249'))
        self.assertEqual(row['fiber'], Decimal('2.1'))
        self.assertEqual(len(NAMES), 100)

    def test_does_not_invent_missing_or_ambiguous_values(self):
        item = food()
        item['foodNutrients'].pop()
        self.assertEqual(extract({'SurveyFoods': [item]}), [])
        item = food()
        item['foodNutrients'].append({'nutrient': {'id': 1008, 'unitName': 'kcal'}, 'amount': 5})
        self.assertEqual(extract({'SurveyFoods': [item]}), [])
        with self.assertRaises(ValueError): build_sql([], 'hash')


if __name__ == '__main__': unittest.main()
