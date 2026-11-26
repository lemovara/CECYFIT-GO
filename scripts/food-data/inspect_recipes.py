#!/usr/bin/env python3
"""Inspecciona un CSV o JSON local sin escribir en Supabase ni copiar recetas."""
import argparse
import csv
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path


def normalize(value):
    return ''.join(ch for ch in unicodedata.normalize('NFKD', str(value or '').casefold())
                   if not unicodedata.combining(ch)).strip()


def field(row, *names):
    normalized = {normalize(key): value for key, value in row.items() if key is not None}
    return next((str(normalized[name]).strip() for name in names if normalized.get(name) is not None), '')


def inspect(rows, mexican_only=False):
    counts = Counter()
    seen = set()
    examples = []
    for index, row in enumerate(rows, 1):
        counts['rows_read'] += 1
        if not isinstance(row, dict):
            counts['invalid_rows'] += 1
            continue
        country = normalize(field(row, 'pais', 'country'))
        if mexican_only and country not in {'mexico', 'mex', 'mx'}:
            counts['excluded_country'] += 1
            continue
        name = field(row, 'nombre', 'name', 'title', 'titulo')
        ingredients = field(row, 'ingredientes', 'ingredients')
        steps = field(row, 'pasos', 'instrucciones', 'steps', 'instructions')
        source = field(row, 'url', 'source_url', 'fuente')
        if not name:
            counts['missing_name'] += 1
            continue
        identity = normalize(source) or normalize(name)
        if identity in seen:
            counts['duplicates'] += 1
            continue
        seen.add(identity)
        reasons = []
        if not ingredients: reasons.append('missing_ingredients')
        if not steps: reasons.append('missing_steps')
        if not source: reasons.append('missing_source')
        if re.search(r'\b(al gusto|una pizca|cantidad suficiente|c/?s)\b', normalize(ingredients)):
            reasons.append('indeterminate_quantity')
        # Ingredient matching, gram conversions and nutrient values require review.
        reasons.append('unmapped_ingredients')
        for reason in reasons: counts[reason] += 1
        counts['needs_review'] += 1
        if len(examples) < 20:
            examples.append({'row': index, 'name': name, 'reasons': reasons})
    return {'mode': 'dry-run', 'counts': dict(counts), 'examples': examples,
            'imported': 0, 'note': 'No se han modificado datos ni calculado nutrientes.'}


def read_rows(path):
    with path.open(encoding='utf-8-sig', newline='') as file:
        if path.suffix.lower() == '.csv':
            yield from csv.DictReader(file)
        elif path.suffix.lower() == '.json':
            data = json.load(file)
            if not isinstance(data, list): raise ValueError('El JSON debe contener una lista de recetas.')
            yield from data
        else:
            raise ValueError('Formato no compatible: usa CSV o JSON.')


def main():
    parser = argparse.ArgumentParser(description='Inspección sin importación de recetas locales')
    parser.add_argument('input', type=Path)
    parser.add_argument('--mexico', action='store_true', help='Incluir solo filas identificadas como México, MEX o MX')
    args = parser.parse_args()
    try:
        print(json.dumps(inspect(read_rows(args.input), args.mexico), ensure_ascii=False, indent=2))
    except (OSError, ValueError, csv.Error) as error:
        parser.exit(2, f'Error al leer el archivo: {error}\n')


if __name__ == '__main__':
    main()
