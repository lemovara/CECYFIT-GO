export type LocalFoodResult = { type: 'recipe' | 'food'; id: string; name: string; terms: string[] };

const aliases = [
  ['jitomate', 'tomate rojo'], ['tomate verde', 'tomatillo'], ['aguacate', 'palta'],
  ['elote', 'maiz tierno'], ['frijol', 'poroto'], ['calabacita', 'calabacin'],
];
export const normalizeFoodText = (value: string) => value.toLocaleLowerCase('es-MX').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim();

export function searchLocalFoods(items: LocalFoodResult[], query: string, type: 'all' | LocalFoodResult['type']): LocalFoodResult[] {
  const text = normalizeFoodText(query);
  const expanded = aliases.find(group => group.some(alias => normalizeFoodText(alias) === text));
  const alternatives = new Set(expanded ? expanded.map(normalizeFoodText) : [text]);
  if (!expanded) for (const group of aliases) for (const alias of group) {
    const pattern = new RegExp(`(^| )${normalizeFoodText(alias)}(?= |$)`, 'g');
    if (pattern.test(text)) for (const alternative of group) alternatives.add(text.replace(pattern, (_, prefix: string) => prefix + normalizeFoodText(alternative)));
  }
  return items.filter(item => {
    if (type !== 'all' && item.type !== type) return false;
    const haystack = normalizeFoodText([item.name, ...item.terms].join(' '));
    return [...alternatives].some(alternative => alternative.split(' ').every(term => haystack.includes(term)));
  }).sort((a, b) => a.name.localeCompare(b.name, 'es-MX'));
}
