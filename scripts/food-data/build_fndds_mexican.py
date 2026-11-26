#!/usr/bin/env python3
"""Prepare a reproducible USDA FNDDS catalog of 100 prepared foods, without inventing recipes."""
import argparse
import hashlib
import io
import json
import urllib.request
import zipfile
from decimal import Decimal, InvalidOperation
from pathlib import Path

URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip'
EXPECTED_SHA256 = 'dfb06ae7ddc397ccd570b91c14b75438ab2ba39f64f22d321f61d4a52a77f3eb'
NAMES = {
2707343:'Burrito de huevo',2707344:'Burrito de huevo con salchicha',2707345:'Burrito de huevo con tocino',2707346:'Burrito de huevo con jamón',2708038:'Tamal dulce',
2708514:'Taco sin especificar',2708515:'Taco de tortilla de maíz con res y queso',2708516:'Taco de maíz con res, frijoles y queso',2708517:'Taco de maíz con cerdo y queso',2708518:'Taco de maíz con cerdo, frijoles y queso',2708519:'Taco de maíz con pollo y queso',2708520:'Taco de maíz con pollo, frijoles y queso',2708521:'Taco de maíz con frijoles y queso',
2708522:'Taco de harina con res y queso',2708523:'Taco de harina con res, frijoles y queso',2708524:'Taco de harina con cerdo y queso',2708525:'Taco de harina con cerdo, frijoles y queso',2708526:'Taco de harina con pollo y queso',2708527:'Taco de harina con pollo, frijoles y queso',2708528:'Taco de harina con frijoles y queso',2708529:'Taco de pescado',2708530:'Taco de carne sin queso',2708531:'Taco de carne y frijoles sin queso',2708532:'Taco de frijoles sin queso',2708533:'Taco solo de queso',
2708534:'Burrito sin especificar',2708535:'Burrito de res y queso',2708536:'Burrito de res con arroz y queso',2708537:'Burrito de res con frijoles y queso',2708538:'Burrito de res con frijoles, arroz y queso',2708539:'Burrito de cerdo y queso',2708540:'Burrito de cerdo con arroz y queso',2708541:'Burrito de cerdo con frijoles y queso',2708542:'Burrito de cerdo con frijoles, arroz y queso',2708543:'Burrito de pollo y queso',2708544:'Burrito de pollo con arroz y queso',2708545:'Burrito de pollo con frijoles y queso',2708546:'Burrito de pollo con frijoles, arroz y queso',2708547:'Burrito de frijoles sin queso',2708548:'Burrito de frijoles y queso',2708549:'Burrito de frijoles, arroz y queso',2708550:'Burrito de carne sin queso',2708551:'Burrito de carne y arroz sin queso',2708552:'Burrito de carne y frijoles sin queso',2708553:'Burrito de carne, frijoles y arroz sin queso',2708554:'Burrito solo de queso',
2708555:'Tazón estilo burrito sin especificar',2708556:'Tazón estilo burrito con res o cerdo',2708557:'Tazón estilo burrito con res o cerdo y arroz',2708558:'Tazón estilo burrito con res o cerdo y frijoles',2708559:'Tazón estilo burrito con res o cerdo, frijoles y arroz',2708560:'Tazón estilo burrito con pollo',2708561:'Tazón estilo burrito con pollo y arroz',2708562:'Tazón estilo burrito con pollo y frijoles',2708563:'Tazón estilo burrito con pollo, frijoles y arroz',2708564:'Tazón estilo burrito con frijoles',
2708565:'Enchilada sin especificar',2708566:'Enchilada de res',2708567:'Enchilada de cerdo',2708568:'Enchilada de pollo',2708569:'Enchilada sin carne',2708570:'Tamal sin especificar',2708571:'Tamal de res',2708572:'Tamal de cerdo',2708573:'Tamal de pollo',2708574:'Tamal sin carne',2708575:'Cazuela de tamal con carne',
2708590:'Quesadilla sin especificar',2708591:'Quesadilla solo de queso',2708592:'Quesadilla de res o cerdo',2708593:'Quesadilla de pollo',2708594:'Quesadilla con verduras',2708595:'Quesadilla de res o cerdo con verduras',2708596:'Quesadilla de pollo con verduras',2708597:'Quesadilla de huevo',2708598:'Quesadilla de huevo con carne',
2709736:'Salsa sin especificar',2709737:'Salsa pico de gallo',2709738:'Salsa roja',2709739:'Salsa roja casera',2709741:'Salsa roja para enchiladas',2709742:'Salsa verde para enchiladas',2709743:'Salsa verde',
2705629:'Helado sin especificar',2705630:'Helado de vainilla',2705631:'Helado de vainilla con ingredientes adicionales',2705632:'Helado de chocolate',2705633:'Helado de chocolate con ingredientes adicionales',2705634:'Helado suave de vainilla',2705635:'Helado suave de chocolate',2705663:'Helado frito',2707402:'Hummus natural',2707403:'Hummus saborizado',2707871:'Pastel de chocolate sin harina',2707909:'Galleta con chispas de chocolate',2707911:'Galleta con chispas de chocolate reducida en grasa',2707912:'Galleta sándwich con chispas de chocolate',2707913:'Galleta de chocolate con cereal de arroz',2707914:'Galleta de chocolate con avena y coco sin hornear',2707915:'Galleta de chocolate o fudge',
}
NUTRIENTS = {'kcal': 1008, 'protein': 1003, 'carbs': 1005, 'fat': 1004, 'fiber': 1079}


def extract(data):
    found = {}
    for food in data.get('SurveyFoods', []):
        fid = food.get('fdcId')
        if fid not in NAMES: continue
        values, ambiguous = {}, set()
        for row in food.get('foodNutrients', []):
            nutrient = row.get('nutrient') or {}
            ident = nutrient.get('id')
            if ident not in NUTRIENTS.values(): continue
            try: amount = Decimal(str(row.get('amount')))
            except (InvalidOperation, ValueError): continue
            unit = 'kcal' if ident == 1008 else 'g'
            if not amount.is_finite() or amount < 0 or str(nutrient.get('unitName','')).lower() != unit: continue
            if ident in values and values[ident] != amount: ambiguous.add(ident)
            values[ident] = amount
        if any(v not in values or v in ambiguous for v in NUTRIENTS.values()): continue
        if fid in found: raise ValueError(f'Identificador duplicado: {fid}')
        found[fid] = {'id': fid, 'name': NAMES[fid], 'original': food['description'],
                      **{key: values[value] for key, value in NUTRIENTS.items()}}
    return [found[key] for key in sorted(found)]


def q(value): return "'" + str(value).replace("'", "''") + "'"


def build_sql(rows, digest):
    if len(rows) != len(NAMES): raise ValueError(f'Se esperaban {len(NAMES)} alimentos completos; hay {len(rows)}.')
    values = []
    for row in rows:
        fid = row['id']
        cells = [q(f'usda-fndds-{fid}'),q(row['name']),*(str(row[key]) for key in NUTRIENTS),
                 q('USDA FoodData Central · FNDDS 2021–2023'),q(fid),q(f'https://fdc.nal.usda.gov/food-details/{fid}/nutrients'),
                 q('Public domain'),q(row['original']),'1008']
        values.append('  (' + ','.join(cells) + ')')
    return ('-- USDA FNDDS 2021–2023 ZIP SHA-256: ' + digest + '\n'
            'insert into public.food_ingredients(id,name,kcal,protein,carbs,fat,fiber,source_name,source_id,source_url,source_license,original_name,energy_nutrient_id) values\n'
            + ',\n'.join(values) + '\non conflict (id) do nothing;\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    raw = args.archive.read_bytes() if args.archive else urllib.request.urlopen(URL,timeout=60).read()
    digest = hashlib.sha256(raw).hexdigest()
    if digest != EXPECTED_SHA256: raise ValueError('El archivo USDA no coincide con la versión usada para las traducciones.')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        files = [name for name in archive.namelist() if name.endswith('.json')]
        if len(files) != 1: raise ValueError('Se esperaba un JSON en el archivo USDA.')
        rows = extract(json.loads(archive.read(files[0]),parse_float=Decimal))
    if args.output: args.output.write_text(build_sql(rows,digest),encoding='utf-8')
    print(json.dumps({'selected':len(NAMES),'complete':len(rows),'sha256':digest},ensure_ascii=False))


if __name__ == '__main__': main()
