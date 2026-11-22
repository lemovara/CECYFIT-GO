"""Emite SQL de referencias de Tlaxcala desde un CSV oficial de QQP."""

import argparse
import csv
import re
import unicodedata
from datetime import date
from decimal import Decimal, InvalidOperation


def normalize(text):
    text = unicodedata.normalize("NFD", text.upper())
    return "".join(char for char in text if not unicodedata.combining(char)).strip()


def chain(value):
    value = normalize(value).replace("-", "")
    for key, name in (("AURRERA", "Bodega Aurrera"), ("SORIANA", "Soriana"),
                      ("WALMART", "Walmart"), ("CHEDRAUI", "Chedraui"), ("SAM", "Sam’s Club")):
        if key in value:
            return name
    return None


def ingredient(product, pack):
    product, pack = normalize(product), normalize(pack)
    if product == "CARNE POLLO" and "PECHUGA" in pack and ("SIN HUESO" in pack or "FILETE" in pack) and "CON PIEL" not in pack:
        return "pollo"
    if product == "ARROZ" and "INTEGRAL" not in pack and re.search(r"EXTRA|GRANO|BLANCO", pack):
        return "arroz"
    if product in {"BROCOLI", "ZANAHORIA", "JITOMATE"} and "GRANEL" in pack:
        return product.lower()
    if product == "AVENA" and ("HOJUELA INTEGRAL" in pack or re.fullmatch(r"(BOLSA|BOTE) \d+ GR\.?", pack)):
        return "avena"
    if product == "FRIJOL" and "NEGRO" in pack and "GRANEL" not in pack:
        return "frijol"
    return None


def sql_text(value):
    return "'" + value.replace("'", "''") + "'"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_path")
    parser.add_argument("--encoding", default="utf-8-sig")
    args = parser.parse_args()
    latest = {}
    with open(args.csv_path, encoding=args.encoding, newline="") as source:
        for row in csv.DictReader(source):
            if normalize(row["estado"]) != "TLAXCALA":
                continue
            store = chain(row["cadena_comercial"])
            pack = row["presentacion"].strip()
            item = ingredient(row["producto"], pack)
            branch = row["nombre_comercial"].strip()
            size = re.search(r"\b(\d+(?:\.\d+)?)\s*(KG|GR|G)\b", normalize(pack))
            if not store or not item or not branch or not size:
                continue
            try:
                grams = int(Decimal(size[1]) * (1000 if size[2] == "KG" else 1))
                cost = Decimal(row["precio"])
                observed = date.fromisoformat(row["fecha_registro"].replace("/", "-"))
                if grams <= 0 or grams > 100000 or not cost.is_finite() or not 0 < cost <= 100000:
                    continue
            except (InvalidOperation, ValueError):
                continue
            key = (store, branch.lower(), item)
            brand = row["marca"].strip()
            candidate = (observed, cost, grams, branch, row["municipio"].strip(), pack, brand)
            previous = latest.get(key)
            if not previous or (observed, -cost / grams, pack, brand) > (
                previous[0], -previous[1] / previous[2], previous[5], previous[6]
            ):
                latest[key] = candidate
    if not latest:
        raise SystemExit("No hay referencias compatibles de Tlaxcala en el archivo.")

    print("insert into public.market_reference_prices")
    print("  (store,branch,ingredient_id,display_branch,municipality,pack_grams,pack_price,sold_by_weight,observed_on,presentation,brand) values")
    values = []
    for (store, branch, item), (observed, cost, grams, display, municipality, pack, brand) in sorted(latest.items()):
        fields = [sql_text(value) for value in (store, branch, item, display, municipality)]
        fields.extend([str(grams), str(cost), str("GRANEL" in normalize(pack)).lower(),
                       sql_text(observed.isoformat()), sql_text(pack), sql_text(brand)])
        values.append("  (" + ",".join(fields) + ")")
    print(",\n".join(values))
    print("on conflict (store,branch,ingredient_id) do update set")
    print("  display_branch=excluded.display_branch, municipality=excluded.municipality, pack_grams=excluded.pack_grams,")
    print("  pack_price=excluded.pack_price, sold_by_weight=excluded.sold_by_weight, observed_on=excluded.observed_on,")
    print("  presentation=excluded.presentation, brand=excluded.brand")
    print("where excluded.observed_on >= market_reference_prices.observed_on;")


if __name__ == "__main__":
    main()
