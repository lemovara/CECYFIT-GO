import unittest
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from import_recipes import prepare, build_sql


CATALOG = [
    {'id': 'tomate', 'name': 'Jitomate', 'kcal': 20, 'protein': 1, 'carbs': 4, 'fat': 0, 'fiber': 1},
    {'id': 'avena', 'name': 'Avena seca', 'kcal': 379, 'protein': 13.15, 'carbs': 67.7, 'fat': 6.52, 'fiber': 10.1},
]
RECIPE = {'nombre': 'Ejemplo de prueba', 'pais': 'México', 'pasos': 'Preparar.',
          'source_name': 'Fixture', 'source_url': 'https://example.test/1', 'source_license': 'fixture',
          'ingredientes': [{'name': 'tomate rojo', 'amount': 0.1, 'unit': 'kg'}, {'food_id': 'avena', 'grams': 50}]}


class ImportRecipesTest(unittest.TestCase):
    def test_matching_alias_conversion_nutrition_and_unknowns(self):
        recipes, report = prepare([RECIPE], CATALOG)
        self.assertEqual(report['counts']['ready'], 1)
        self.assertFalse(report['database_modified'])
        self.assertEqual(recipes[0]['ingredients'], {'avena': 50, 'tomate': 100})
        self.assertAlmostEqual(recipes[0]['nutrients']['kcal'], 209.5)
        self.assertAlmostEqual(recipes[0]['nutrients']['fiber'], 6.05)
        self.assertEqual(recipes[0]['id'], prepare([RECIPE], CATALOG)[0][0]['id'])

    def test_rejects_indeterminate_quantities_duplicates_and_wrong_country(self):
        rows = [RECIPE, RECIPE, {**RECIPE, 'nombre': 'Otra', 'source_url': 'https://example.test/2', 'ingredientes': 'sal al gusto'},
                {**RECIPE, 'pais': 'Perú'}]
        recipes, report = prepare(rows, CATALOG)
        self.assertEqual(len(recipes), 1)
        self.assertEqual(report['counts']['needs_review'], 2)
        self.assertEqual(report['counts']['excluded_country'], 1)
        self.assertEqual(report['errors'][1]['reason'], 'quantity_or_unit_requires_review')

    def test_never_assumes_volume_or_unmatched_food(self):
        rows = [{**RECIPE, 'ingredientes': '1 taza de avena'},
                {**RECIPE, 'ingredientes': '100 g de alimento desconocido'}]
        recipes, report = prepare(rows, CATALOG)
        self.assertEqual(recipes, [])
        self.assertEqual(report['counts']['needs_review'], 2)

    def test_conversions_are_specific_to_food_and_unit(self):
        conversions = [{'food_id': 'avena', 'unit': 'taza', 'grams_per_unit': 80, 'source': 'medición de prueba'}]
        rows = [{**RECIPE, 'ingredientes': '1/2 taza de Avena seca'},
                {**RECIPE, 'nombre': 'Otra', 'source_url': 'https://example.test/2', 'ingredientes': '1 taza de jitomate'}]
        recipes, report = prepare(rows, CATALOG, conversions=conversions)
        self.assertEqual(recipes[0]['ingredients'], {'avena': 40})
        self.assertEqual(recipes[0]['conversions'][0]['source'], 'medición de prueba')
        self.assertEqual(report['errors'][0]['reason'], 'quantity_or_unit_requires_review')
        changed = [{**conversions[0], 'source': 'otra fuente'}]
        self.assertNotEqual(recipes[0]['digest'], prepare(rows[:1], CATALOG, conversions=changed)[0][0]['digest'])

    def test_invalid_or_ambiguous_conversions_fail_safely(self):
        base = {'food_id': 'avena', 'unit': 'taza', 'grams_per_unit': 80, 'source': 'prueba'}
        for bad in [0, -1, 'NaN', 'Infinity']:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                prepare([RECIPE], CATALOG, conversions=[{**base, 'grams_per_unit': bad}])
        with self.assertRaises(ValueError): prepare([RECIPE], CATALOG, conversions=[base, base])
        with self.assertRaises(ValueError): prepare([RECIPE], CATALOG, conversions=[{**base, 'source': ''}])
        ambiguous = CATALOG + [{**CATALOG[0], 'id': 'tomate2', 'name': 'Tomate rojo'}]
        row = {**RECIPE, 'ingredientes': '1 taza de tomate rojo'}
        _, report = prepare([row], ambiguous, conversions=[{**base, 'food_id': 'tomate'}])
        self.assertEqual(report['errors'][0]['reason'], 'ingredient_unknown_or_ambiguous')

    def test_missing_nutrient_requires_review(self):
        recipes, report = prepare([RECIPE], [CATALOG[0], {**CATALOG[1], 'fiber': None}])
        self.assertEqual(recipes, [])
        self.assertEqual(report['errors'][0]['reason'], 'composition_incomplete')

    def test_ambiguous_alias_requires_review(self):
        recipes, report = prepare([RECIPE], CATALOG + [{**CATALOG[0], 'id': 'tomate2', 'name': 'Tomate rojo'}])
        self.assertEqual(recipes, [])
        self.assertEqual(report['errors'][0]['reason'], 'ingredient_unknown_or_ambiguous')

    def test_sql_escapes_and_refuses_overwrite(self):
        recipes, _ = prepare([{**RECIPE, 'nombre': "Sopa d'ejemplo"}], CATALOG)
        sql = build_sql(recipes)
        self.assertIn("Sopa d''ejemplo", sql)
        self.assertIn('content_digest is distinct from', sql)
        self.assertIn('Recipe ingredients changed', sql)
        self.assertIn('on conflict (id) do nothing', sql)
        self.assertTrue(sql.endswith('commit;\n'))

    def test_cli_is_dry_run_and_can_generate_reviewable_sql(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp)
            recipes, catalog, output = directory / 'recipes.json', directory / 'catalog.json', directory / 'import.sql'
            recipes.write_text(json.dumps([RECIPE], ensure_ascii=False), encoding='utf-8')
            catalog.write_text(json.dumps(CATALOG, ensure_ascii=False), encoding='utf-8')
            script = Path(__file__).with_name('import_recipes.py')
            result = subprocess.run([sys.executable, str(script), str(recipes), '--catalog', str(catalog), '--output', str(output)],
                                    check=True, capture_output=True, text=True, encoding='utf-8')
            report = json.loads(result.stdout)
            self.assertEqual(report['counts']['ready'], 1)
            self.assertFalse(report['database_modified'])
            self.assertIn('begin;', output.read_text(encoding='utf-8'))


if __name__ == '__main__': unittest.main()
