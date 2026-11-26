#!/usr/bin/env python3
"""Generate an idempotent SQL import from USDA Foundation Foods JSON ZIP."""
import argparse
import hashlib
import io
import json
import urllib.request
import zipfile
from decimal import Decimal, InvalidOperation
from pathlib import Path

DATA_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-10-29.zip'
TRANSLATIONS = {
    321360: 'Jitomate uva crudo', 323505: 'Col rizada cruda', 325430: 'Durazno amarillo crudo',
    327046: 'Kiwi verde crudo', 327357: 'Nectarina cruda', 746764: 'Zanahoria congelada sin preparar',
    746768: 'Higo seco sin cocinar', 746769: 'Lechuga romana cruda', 746770: 'Melón cantalupo crudo',
    746771: 'Naranja navel cruda', 746773: 'Pera Bartlett cruda', 747447: 'Brócoli crudo',
    748967: 'Huevo entero grado A grande', 790018: 'Harina de trigo todo uso sin enriquecer',
    790085: 'Harina de trigo integral sin enriquecer', 790214: 'Harina de arroz blanco sin enriquecer',
    790276: 'Harina de maíz amarillo fina enriquecida', 790577: 'Cebolla morada cruda',
    790646: 'Cebolla amarilla cruda', 1104647: 'Ajo crudo', 1104962: 'Cebolla blanca cruda',
    1105073: 'Plátano muy maduro crudo', 1105314: 'Plátano maduro o ligeramente maduro crudo',
    1750339: 'Manzana Red Delicious cruda con cáscara', 1750340: 'Manzana Fuji cruda con cáscara',
    1750341: 'Manzana Gala cruda con cáscara', 1750342: 'Manzana Granny Smith cruda con cáscara',
    1750343: 'Manzana Honeycrisp cruda con cáscara', 1999627: 'Hongo ostra',
    1999628: 'Hongo shiitake', 1999629: 'Champiñón blanco', 1999632: 'Espinaca tierna',
    1999633: 'Espinaca madura', 1999634: 'Jitomate tipo Roma', 2003598: 'Hongo portobello',
    2258586: 'Zanahoria madura cruda', 2258587: 'Zanahoria baby cruda',
    2258588: 'Pimiento verde crudo', 2258589: 'Pimiento amarillo crudo',
    2258590: 'Pimiento rojo crudo', 2258591: 'Pimiento naranja crudo',
    2261420: 'Harina de almendra', 2261421: 'Harina integral de avena', 2261422: 'Harina de papa',
    2262075: 'Linaza molida', 2346392: 'Piñones crudos', 2346393: 'Almendras enteras crudas',
    2346394: 'Nuez de Castilla cruda en mitades', 2346395: 'Nuez pecana cruda en mitades',
    2346398: 'Piña cruda', 2346400: 'Ejote crudo', 2512371: 'Harina de amaranto',
    2512372: 'Harina de quinoa', 2512373: 'Harina de sorgo', 2512374: 'Harina de trigo sarraceno',
    2512375: 'Harina de centeno', 2512376: 'Harina de cebada', 2512377: 'Harina de yuca',
    2512380: 'Arroz integral de grano largo crudo sin enriquecer', 2512381: 'Arroz blanco de grano largo crudo sin enriquecer',
    2515376: 'Cacahuate crudo', 2515380: 'Semilla de calabaza cruda', 2515381: 'Semilla de girasol cruda',
    2685568: 'Calabacita verde cruda con cáscara', 2685573: 'Coliflor cruda',
    2685575: 'Coles de Bruselas crudas', 2685576: 'Betabel crudo', 2685577: 'Berenjena cruda',
    2710823: 'Espárrago verde crudo', 2710826: 'Elote amarillo y blanco fresco crudo',
    2710831: 'Kiwi verde pelado crudo', 2710832: 'Mandarina pelada sin semilla cruda',
    2710833: 'Mango Tommy Atkins pelado crudo', 2710834: 'Mango Ataulfo pelado crudo',
    2710835: 'Harina de maíz nixtamalizada seca cruda', 2710837: 'Ciruela negra cruda con cáscara',
    2747661: 'Chile jalapeño crudo sin semillas', 2747662: 'Chile poblano crudo sin semillas',
    2747663: 'Chile serrano crudo sin semillas', 2747665: 'Rábano rojo crudo',
    2758984: 'Frijoles bayos refritos enlatados', 2758985: 'Frijoles refritos vegetarianos enlatados',
    2758993: 'Pan blanco comercial', 2758994: 'Pan comercial 100 % de trigo integral',
    2758996: 'Tortilla de harina de trigo de larga duración', 2758997: 'Tortilla de maíz de larga duración',
    2758998: 'Espagueti seco enriquecido', 2759000: 'Espagueti seco integral',
}
NUTRIENTS = {'protein': 1003, 'fat': 1004, 'carbs': 1005, 'fiber': 1079}
ENERGY_IDS = (2047, 2048, 1008)


def extract_foods(data):
    result, seen = [], set()
    for food in data.get('FoundationFoods', []):
        fdc_id = food.get('fdcId')
        if not isinstance(fdc_id, int) or fdc_id in seen or not food.get('description'):
            continue
        found, ambiguous = {}, set()
        for row in food.get('foodNutrients', []):
            nutrient = row.get('nutrient') or {}
            key, amount, unit = nutrient.get('id'), row.get('amount'), nutrient.get('unitName', '')
            if key not in (*NUTRIENTS.values(), *ENERGY_IDS) or amount is None:
                continue
            try: value = Decimal(str(amount))
            except InvalidOperation: continue
            if not value.is_finite() or value < 0: continue
            expected_unit = 'kcal' if key in ENERGY_IDS else 'g'
            if str(unit).lower() != expected_unit: continue
            if key in found and found[key] != value: ambiguous.add(key)
            found[key] = value
        if any(key not in found or key in ambiguous for key in NUTRIENTS.values()): continue
        energy_id = next((key for key in ENERGY_IDS if key in found and key not in ambiguous), None)
        if energy_id is None: continue
        seen.add(fdc_id)
        original = str(food['description']).strip()
        result.append({'fdc_id': fdc_id, 'name': TRANSLATIONS.get(fdc_id, original), 'original_name': original,
                       'energy_id': energy_id, 'kcal': found[energy_id],
                       **{name: found[key] for name, key in NUTRIENTS.items()}})
    return sorted(result, key=lambda row: row['fdc_id'])


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def build_sql(foods, digest):
    lines = ['-- USDA Foundation Foods 2026-10-29, CC0 1.0; archive SHA256: ' + digest,
             'alter table public.food_ingredients add column if not exists source_name text, add column if not exists source_id text,',
             '  add column if not exists source_url text, add column if not exists source_license text, add column if not exists original_name text,',
             '  add column if not exists energy_nutrient_id integer;',
             'insert into public.food_ingredients (id,name,kcal,protein,carbs,fat,fiber,source_name,source_id,source_url,source_license,original_name,energy_nutrient_id) values']
    rows = []
    for food in foods:
        fid = food['fdc_id']
        values = [quote(f'usda-fdc-{fid}'), quote(food['name']), str(food['kcal']), str(food['protein']),
                  str(food['carbs']), str(food['fat']), str(food['fiber']), quote('USDA FoodData Central · Foundation Foods 2026-10-29'),
                  quote(fid), quote(f'https://fdc.nal.usda.gov/food-details/{fid}/nutrients'), quote('CC0 1.0'),
                  quote(food['original_name']), str(food['energy_id'])]
        rows.append('  (' + ','.join(values) + ')')
    if not rows: raise ValueError('No se encontraron alimentos completos; no se generó SQL.')
    lines += [',\n'.join(rows), 'on conflict (id) do nothing;']
    return '\n'.join(lines) + '\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, help='ZIP ya descargado; si se omite se consulta USDA')
    parser.add_argument('--output', type=Path, help='Ruta de salida SQL. Si se omite, solo muestra conteos.')
    args = parser.parse_args()
    raw = args.archive.read_bytes() if args.archive else urllib.request.urlopen(DATA_URL, timeout=60).read()
    digest = hashlib.sha256(raw).hexdigest()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        files = [name for name in archive.namelist() if name.endswith('.json')]
        if len(files) != 1: raise ValueError('Se esperaba un único JSON USDA dentro del ZIP.')
        data = json.loads(archive.read(files[0]), parse_float=Decimal)
    foods = extract_foods(data)
    if args.output: args.output.write_text(build_sql(foods, digest), encoding='utf-8')
    print(json.dumps({'source_count': len(data.get('FoundationFoods', [])), 'complete_count': len(foods),
                      'spanish_names': sum(row['fdc_id'] in TRANSLATIONS for row in foods), 'sha256': digest}, ensure_ascii=False))


if __name__ == '__main__': main()
