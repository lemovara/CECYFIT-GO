#!/usr/bin/env python3
"""Validate recipe files and generate an insert-only Supabase migration; dry-run by default."""
import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlsplit

from inspect_recipes import normalize, read_rows

ALIASES = [
    ('jitomate', 'tomate rojo'), ('tomate verde', 'tomatillo'), ('aguacate', 'palta'),
    ('elote', 'maiz tierno'), ('frijol', 'poroto'), ('calabacita', 'calabacin'),
]
NUTRIENTS = ('kcal', 'protein', 'carbs', 'fat', 'fiber')


def clean(value):
    return ' '.join(str(value or '').split())


def catalog_index(catalog):
    ids, names = {}, defaultdict(set)
    for item in catalog:
        if not isinstance(item, dict) or not clean(item.get('id')) or not clean(item.get('name')):
            raise ValueError('Cada ingrediente del catálogo requiere id y nombre.')
        key = clean(item['id'])
        if key in ids:
            raise ValueError(f'Identificador de ingrediente duplicado: {key}')
        ids[key] = item
        names[normalize(item['name'])].add(key)
    for group in ALIASES:
        matches = set().union(*(names[normalize(alias)] for alias in group))
        for alias in group:
            names[normalize(alias)].update(matches)
    return ids, names


def parse_ingredients(value):
    if isinstance(value, str):
        value = value.strip()
        if value.startswith('['):
            try: value = json.loads(value)
            except json.JSONDecodeError: raise ValueError('ingredients_json_invalid')
        else:
            value = [line.strip(' -\t') for line in value.splitlines() if line.strip(' -\t')]
    if not isinstance(value, list) or not value or len(value) > 30:
        raise ValueError('ingredients_missing_or_too_many')
    result = []
    for item in value:
        if isinstance(item, str):
            match = re.fullmatch(r'\s*(\d+(?:[.,]\d+)?(?:/\d+)?)\s*([^\W\d_]+)\s+(?:de\s+)?(.+?)\s*', item, re.I)
            if not match: raise ValueError('quantity_or_unit_requires_review')
            amount, unit, name = match.groups()
            item = {'name': name, 'amount': amount, 'unit': unit}
        if not isinstance(item, dict): raise ValueError('ingredient_invalid')
        name, food_id = clean(item.get('name')), clean(item.get('food_id'))
        if not name and not food_id: raise ValueError('ingredient_name_missing')
        unit = normalize(item.get('unit') or ('g' if item.get('grams') is not None else ''))
        try:
            raw = str(item.get('grams') if item.get('grams') is not None else item.get('amount')).replace(',', '.')
            parts = raw.split('/')
            if len(parts) > 2: raise ValueError('quantity_invalid')
            amount = Decimal(parts[0]) / Decimal(parts[1]) if len(parts) == 2 else Decimal(parts[0])
        except (InvalidOperation, ValueError, ZeroDivisionError): raise ValueError('quantity_invalid')
        if not amount.is_finite(): raise ValueError('quantity_invalid')
        result.append((name, food_id, amount, unit))
    return result


def conversion_index(conversions, ids):
    result = {}
    if not isinstance(conversions, list): raise ValueError('Las conversiones deben ser una lista JSON.')
    for item in conversions:
        if not isinstance(item, dict): raise ValueError('Conversión inválida.')
        food_id, unit, source = clean(item.get('food_id')), normalize(item.get('unit')), clean(item.get('source'))
        try: factor = Decimal(str(item.get('grams_per_unit')))
        except InvalidOperation: raise ValueError('Conversión inválida.')
        if food_id not in ids or not unit or not source or not factor.is_finite() or factor <= 0 or factor > 5000:
            raise ValueError('Conversión inválida: requiere ingrediente, unidad, fuente y gramos positivos.')
        if unit in ('g', 'gramo', 'gramos', 'kg', 'kilogramo', 'kilogramos') or (food_id, unit) in result:
            raise ValueError('Conversión duplicada o unidad de masa reservada.')
        result[(food_id, unit)] = (factor, source)
    return result


def prepare(rows, catalog, mexican_only=True, conversions=None):
    ids, names = catalog_index(catalog)
    factors = conversion_index(conversions or [], ids)
    counts, accepted, errors, seen_keys, seen_names = Counter(), [], [], set(), set()
    for index, row in enumerate(rows, 1):
        counts['rows_read'] += 1
        try:
            if not isinstance(row, dict): raise ValueError('row_invalid')
            fields = {normalize(k): v for k, v in row.items() if k is not None}
            def get(*keys): return next((fields[k] for k in keys if fields.get(k) not in (None, '')), None)
            country = clean(get('pais', 'country', 'origin_country'))
            if mexican_only and normalize(country) not in ('mexico', 'mex', 'mx'):
                counts['excluded_country'] += 1
                continue
            title = clean(get('nombre', 'title', 'titulo', 'name'))
            steps = get('pasos', 'instructions', 'steps', 'instrucciones', 'description')
            if isinstance(steps, list): steps = '\n'.join(clean(step) for step in steps if clean(step))
            else: steps = str(steps or '').strip()
            source_name = clean(get('source_name', 'fuente'))
            source_url = clean(get('source_url', 'url'))
            license_name = clean(get('source_license', 'license', 'licencia'))
            source_id = clean(get('source_id', 'external_id')) or source_url
            if not title or len(title) > 120 or not steps or len(steps) > 3000:
                raise ValueError('title_or_instructions_invalid')
            if not source_name or not license_name or not source_id or urlsplit(source_url).scheme != 'https' or not urlsplit(source_url).netloc:
                raise ValueError('source_metadata_missing')
            source_key = f'{source_name}:{source_id}'
            if source_key in seen_keys or normalize(title) in seen_names: raise ValueError('duplicate_in_input')
            ingredients = defaultdict(int)
            conversion_sources = []
            for name, food_id, amount, unit in parse_ingredients(get('ingredientes', 'ingredients')):
                matches = {food_id} if food_id in ids else set() if food_id else names.get(normalize(name), set())
                if len(matches) != 1: raise ValueError('ingredient_unknown_or_ambiguous')
                key = next(iter(matches))
                if unit in ('g', 'gramo', 'gramos'): factor = Decimal(1)
                elif unit in ('kg', 'kilogramo', 'kilogramos'): factor = Decimal(1000)
                elif (key, unit) in factors:
                    factor, source = factors[(key, unit)]
                    conversion_sources.append({'food_id': key, 'unit': unit, 'grams_per_unit': str(factor), 'source': source})
                else: raise ValueError('quantity_or_unit_requires_review')
                grams = amount * factor
                if grams <= 0 or grams > 5000 or grams != grams.to_integral_value(): raise ValueError('grams_out_of_range_or_fractional')
                grams = int(grams)
                ingredients[key] += grams
                if ingredients[key] > 5000: raise ValueError('grams_out_of_range_or_fractional')
            composition = {}
            for key in ingredients:
                try:
                    parsed = {nutrient: Decimal(str(ids[key].get(nutrient))) for nutrient in NUTRIENTS}
                    if not all(v.is_finite() and v >= 0 for v in parsed.values()): raise ValueError('composition_incomplete')
                except (InvalidOperation, TypeError): raise ValueError('composition_incomplete')
                composition[key] = {'name': clean(ids[key]['name']), **{nutrient: str(value) for nutrient, value in parsed.items()}}
            nutrients = {}
            for nutrient in NUTRIENTS:
                values = [ids[key].get(nutrient) for key in ingredients]
                try:
                    parsed = [Decimal(str(v)) for v in values]
                    nutrients[nutrient] = float(sum(Decimal(grams) * value / 100 for grams, value in zip(ingredients.values(), parsed))) if all(v.is_finite() and v >= 0 for v in parsed) else None
                except (InvalidOperation, TypeError, ValueError): nutrients[nutrient] = None
            payload = {'source_key': source_key, 'source_name': source_name, 'source_url': source_url,
                       'source_license': license_name, 'country': country, 'title': title, 'description': steps,
                       'ingredients': dict(sorted(ingredients.items())), 'composition': dict(sorted(composition.items()))}
            if conversion_sources: payload['conversions'] = sorted(conversion_sources, key=lambda c: (c['food_id'], c['unit']))
            canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
            payload['id'] = 'import-' + hashlib.sha256(source_key.encode()).hexdigest()[:32]
            payload['digest'] = hashlib.sha256(canonical.encode()).hexdigest()
            payload['nutrients'] = nutrients
            accepted.append(payload)
            seen_keys.add(source_key)
            seen_names.add(normalize(title))
            counts['ready'] += 1
        except (ValueError, TypeError) as error:
            counts['needs_review'] += 1
            errors.append({'row': index, 'reason': str(error)})
    return accepted, {'mode': 'dry-run', 'counts': dict(counts), 'errors': errors, 'database_modified': False}


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def build_sql(recipes):
    if not recipes: raise ValueError('No hay recetas listas para generar SQL.')
    lines = ['-- Insert-only recipe import. Existing content conflicts abort the transaction.', 'begin;']
    for recipe in sorted(recipes, key=lambda item: item['source_key']):
        rid, digest = quote(recipe['id']), quote(recipe['digest'])
        # Use a unique dollar-quote delimiter that cannot occur in input text.
        contents = json.dumps(recipe, ensure_ascii=False)
        tag = '$recipe_' + recipe['digest'][:16] + '$'
        if tag in contents: raise ValueError('Delimitador SQL ambiguo.')
        lines.append(f"select pg_advisory_xact_lock(hashtextextended({quote(recipe['source_key'])},0));")
        for food_id, item in recipe['composition'].items():
            comparisons = ' and '.join(f'{nutrient} is not distinct from {quote(item[nutrient])}::numeric' for nutrient in NUTRIENTS)
            lines.append(f"do {tag} begin if not exists (select 1 from public.food_ingredients where id={quote(food_id)} and name={quote(item['name'])} and {comparisons}) then raise exception 'Ingredient changed or missing: %', {quote(food_id)}; end if; end {tag};")
        expected = quote(json.dumps(recipe['ingredients'], ensure_ascii=False, sort_keys=True, separators=(',', ':')))
        lines.append(f"do {tag} begin if exists (select 1 from public.food_recipes where (id={rid} or source_key={quote(recipe['source_key'])}) and (id<>{rid} or content_digest is distinct from {digest} or title is distinct from {quote(recipe['title'])} or description is distinct from {quote(recipe['description'])} or source_name is distinct from {quote(recipe['source_name'])} or source_url is distinct from {quote(recipe['source_url'])} or source_license is distinct from {quote(recipe['source_license'])} or origin_country is distinct from {quote(recipe['country'])})) then raise exception 'Recipe import conflict: %', {rid}; end if; if exists (select 1 from public.food_recipes where id={rid}) and (select jsonb_object_agg(ingredient_id,grams) from public.food_recipe_items where recipe_id={rid}) is distinct from {expected}::jsonb then raise exception 'Recipe ingredients changed: %', {rid}; end if; end {tag};")
        values = [rid, quote(recipe['title']), quote(recipe['description']), quote(recipe['source_key']),
                  quote(recipe['source_name']), quote(recipe['source_url']), quote(recipe['source_license']), quote(recipe['country']), digest]
        lines.append('insert into public.food_recipes(id,title,description,source_key,source_name,source_url,source_license,origin_country,content_digest) values (' + ','.join(values) + ') on conflict (id) do nothing;')
        for food_id, grams in recipe['ingredients'].items():
            lines.append(f'insert into public.food_recipe_items(recipe_id,ingredient_id,grams) values ({rid},{quote(food_id)},{grams}) on conflict (recipe_id,ingredient_id) do nothing;')
    return '\n'.join(lines + ['commit;', ''])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='CSV o JSON de recetas')
    parser.add_argument('--catalog', type=Path, required=True, help='JSON exportado de food_ingredients')
    parser.add_argument('--conversions', type=Path, help='JSON de equivalencias por ingrediente y unidad')
    parser.add_argument('--include-other-countries', action='store_true')
    parser.add_argument('--output', type=Path, help='Generar SQL para revisar; no ejecuta cambios')
    args = parser.parse_args()
    try:
        catalog = json.loads(args.catalog.read_text(encoding='utf-8-sig'))
        if not isinstance(catalog, list): raise ValueError('El catálogo debe ser una lista JSON.')
        conversions = json.loads(args.conversions.read_text(encoding='utf-8-sig')) if args.conversions else []
        recipes, report = prepare(read_rows(args.input), catalog, not args.include_other_countries, conversions)
        if args.output:
            args.output.write_text(build_sql(recipes), encoding='utf-8')
            report['sql_file'] = str(args.output)
        report['recipes'] = [{'id': r['id'], 'title': r['title'], 'nutrients': r['nutrients'],
                              'conversions': r.get('conversions', [])} for r in recipes]
        print(json.dumps(report, ensure_ascii=False, indent=2))
    except (OSError, ValueError, json.JSONDecodeError) as error:
        parser.exit(2, f'Error: {error}\n')


if __name__ == '__main__': main()
