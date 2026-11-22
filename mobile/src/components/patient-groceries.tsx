import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { quoteGroceries, stores, type MarketPrice, type Store } from '@/lib/grocery-quote';
import type { Meal } from '@/lib/patient-meals';
import { supabase } from '@/lib/supabase';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const mxn = (cents: number) => money.format(cents / 100);

export function PatientGroceries({ meals, day, onBack }: { meals: Meal[]; day: string; onBack: () => void }) {
  const [period, setPeriod] = useState<'day' | 'week'>('week');
  const [store, setStore] = useState<Store>('Soriana');
  const [branch, setBranch] = useState('');
  const [selection, setSelection] = useState<{ store: Store; branch: string }>();
  const [branches, setBranches] = useState<{ store: Store; items: { branch: string; display_branch: string; municipality: string }[] }>();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [grams, setGrams] = useState('');
  const [price, setPrice] = useState('');
  const [bulk, setBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const quote = quoteGroceries(period === 'day' ? meals.filter((item) => item.meal_date === day) : meals, prices);
  const eaten = quote.mealsWithCost.filter(({ meal }) => meal.status === 'CONSUMED');
  const eatenCost = eaten.reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const historical = quote.items.some((item) => item.price?.source === 'PROFECO');
  const storeBranches = branches?.store === store ? branches.items : [];

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from('market_reference_prices').select('branch,display_branch,municipality').eq('store', store)
      .order('display_branch').then(({ data, error }) => {
        if (!active) return;
        const unique = new Map(data?.map((item) => [item.branch, item]));
        setBranches({ store, items: error ? [] : [...unique.values()] });
      });
    return () => { active = false; };
  }, [store]);

  useEffect(() => {
    if (!selection || !supabase) return;
    let active = true;
    const fields = 'ingredient_id,pack_grams,pack_price,sold_by_weight,observed_on';
    void Promise.all([
      supabase.from('market_reference_prices').select(`${fields},presentation,brand`).eq('store', selection.store).eq('branch', selection.branch),
      supabase.from('market_prices').select(fields).eq('store', selection.store).eq('branch', selection.branch),
    ]).then(([reference, personal]) => {
      if (!active) return;
      if (reference.error || personal.error) setError('No pudimos leer todos los precios de esa sucursal.');
      const merged = new Map((reference.data ?? []).map((item) => [item.ingredient_id, { ...item, source: 'PROFECO' } as MarketPrice]));
      for (const item of personal.data ?? []) merged.set(item.ingredient_id, { ...item, source: 'personal' });
      setPrices([...merged.values()]);
    });
    return () => { active = false; };
  }, [selection, attempt]);

  function changeStore(value: Store) {
    setStore(value);
    setSelection(undefined);
    setPrices([]);
    setEditing(null);
    setError('');
  }

  function consult(value: string) {
    const name = value.trim().toLowerCase();
    if (!name) { setError('Indica el nombre o código de la sucursal.'); return; }
    setError('');
    setEditing(null);
    setPrices([]);
    setSelection({ store, branch: name });
  }

  async function savePrice() {
    if (!supabase || !selection || !editing || busy) return;
    const weight = bulk ? 1000 : Number(grams.trim());
    const amount = Number(price.trim().replace(',', '.'));
    if (!Number.isInteger(weight) || weight <= 0 || weight > 100000 || !Number.isFinite(amount) || amount < .01 || amount > 100000) {
      setError('Revisa el gramaje de la presentación y el precio en pesos.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error } = await supabase.rpc('save_market_price', {
        p_store: selection.store, p_branch: selection.branch, p_ingredient_id: editing,
        p_grams: weight, p_price: amount, p_bulk: bulk,
      });
      if (error) throw error;
      setEditing(null);
      setAttempt((value) => value + 1);
    } catch {
      setError('No pudimos guardar el precio. Revisa la conexión y vuelve a intentar.');
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Button label="Volver a Dietas" onPress={onBack} />
    <Text accessibilityRole="header" style={s.title}>Despensa en Tlaxcala</Text>
    <View style={s.row}>
      <Button label="Día seleccionado" selected={period === 'day'} onPress={() => setPeriod('day')} />
      <Button label="Semana del menú" selected={period === 'week'} onPress={() => setPeriod('week')} />
    </View>
    <Text style={s.heading}>Supermercado</Text>
    <View style={s.row}>{stores.map((name) => <Button key={name} label={name} selected={name === store} onPress={() => changeStore(name)} disabled={busy} />)}</View>
    {storeBranches.length > 0 && <View style={s.row}>{storeBranches.map((item) =>
      <Button key={item.branch} label={`${item.display_branch} · ${item.municipality}`} disabled={busy}
        selected={selection?.branch === item.branch} onPress={() => { setBranch(item.display_branch); consult(item.branch); }} />
    )}</View>}
    <TextInput accessibilityLabel="Sucursal en Tlaxcala" placeholder="Sucursal en Tlaxcala" value={branch}
      maxLength={120} editable={!busy} style={s.input} onChangeText={setBranch} />
    <Button label="Consultar precios" onPress={() => consult(branch)} disabled={busy} />
    <Text style={s.body}>{selection ? `${selection.store} · ${selection.branch}. Precios en MXN.` : 'Selecciona una sucursal para consultar o capturar precios.'}</Text>
    {historical && <Text style={s.body}>El cálculo usa referencias históricas de Profeco. Cada ingrediente indica su fecha de observación.</Text>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {quote.items.length > 0 && <View style={s.card}>
      <Text style={s.heading}>{quote.complete ? 'Total estimado de la despensa' : 'Subtotal de ingredientes con precio'} · {mxn(quote.purchase)}</Text>
      <Text style={s.body}>Costo de la cantidad usada {mxn(quote.consumed)}. La despensa incluye las presentaciones completas necesarias.</Text>
      {eaten.length > 0 && <Text style={s.body}>{eaten.some(({ cost }) => cost === null) ? 'Subtotal consumido con precio' : 'Costo de las comidas consumidas del plan'} · {mxn(eatenCost)}</Text>}
      {quote.missing > 0 && <Text style={s.body}>Ingredientes por cotizar: {quote.missing}.</Text>}
    </View>}
    {quote.manualMeals > 0 && <Text style={s.body}>Comidas con gramajes del catálogo pendientes: {quote.manualMeals}.</Text>}
    {quote.mealsWithCost.length === 0 && <Text style={s.body}>Aún no hay comidas asignadas en este periodo.</Text>}
    {quote.items.map(({ ingredient, price: stored, purchase, packages }) => <View key={ingredient.id} style={s.card}>
      {ingredient.photo_url && <Image source={{ uri: ingredient.photo_url }} accessibilityLabel={ingredient.name} style={s.photo} />}
      <Text style={s.heading}>{ingredient.name} · {ingredient.grams} g</Text>
      {stored && purchase !== null
        ? <Text style={s.body}>{mxn(stored.pack_price)} por {stored.pack_grams} g · {stored.observed_on}{packages !== null ? ` · ${packages} presentaciones` : ' · A granel'} · Compra {mxn(purchase)}</Text>
        : <Text style={s.body}>Sin precio para la sucursal seleccionada.</Text>}
      {stored?.source === 'PROFECO' && <Text style={s.body}>Profeco · {stored.presentation} · {stored.brand}</Text>}
      {stored?.source === 'personal' && <Text style={s.body}>Precio capturado por ti</Text>}
      {selection && editing !== ingredient.id && <Button label={stored?.source === 'personal' ? `Editar precio de ${ingredient.name}` : `Capturar precio de ${ingredient.name}`}
        disabled={busy} onPress={() => { setEditing(ingredient.id); setBulk(stored?.sold_by_weight ?? false); setGrams(stored?.pack_grams.toString() ?? ''); setPrice(stored?.pack_price.toString() ?? ''); }} />}
      {editing === ingredient.id && <>
        <View style={s.row}>
          <Button label="Paquete" selected={!bulk} onPress={() => setBulk(false)} disabled={busy} />
          <Button label="A granel por kilo" selected={bulk} onPress={() => setBulk(true)} disabled={busy} />
        </View>
        {!bulk && <TextInput accessibilityLabel="Gramos por paquete" placeholder="Gramos por paquete" keyboardType="number-pad" value={grams} onChangeText={setGrams} editable={!busy} style={s.input} />}
        <TextInput accessibilityLabel="Precio en pesos" placeholder={bulk ? 'Precio por kilo en MXN' : 'Precio del paquete en MXN'} keyboardType="decimal-pad" value={price} onChangeText={setPrice} editable={!busy} style={s.input} />
        <Button label={busy ? 'Guardando…' : 'Guardar precio'} onPress={() => void savePrice()} disabled={busy} />
      </>}
    </View>)}
    {quote.mealsWithCost.length > 0 && <Text accessibilityRole="header" style={s.heading}>Costo por comida del menú</Text>}
    {quote.mealsWithCost.map(({ meal, cost }) => <Text key={meal.id} style={s.body}>
      {meal.meal_date} · {meal.name} · {cost === null ? 'Pendiente de cotizar' : mxn(cost)}
    </Text>)}
  </ScrollView></SafeAreaView>;
}

function Button({ label, onPress, selected, disabled }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={[s.button, selected && s.selected, disabled && s.disabled]}><Text style={s.action}>{label}</Text></Pressable>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' }, page: { padding: 20, gap: 12, paddingBottom: 36 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, title: { fontSize: 26, fontWeight: '900', color: '#1B2A4A' },
  heading: { fontWeight: '800', color: '#1B2A4A' }, body: { color: '#526580', lineHeight: 20 },
  card: { padding: 12, backgroundColor: '#FFFFFF', borderRadius: 12, gap: 8 },
  button: { backgroundColor: '#E7EDFF', borderRadius: 8, padding: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#E7EDFF' },
  selected: { borderColor: '#1C4DFF' }, disabled: { opacity: .55 }, action: { color: '#1C4DFF', fontWeight: '800' },
  input: { borderColor: '#D6DDEB', borderWidth: 1, borderRadius: 10, padding: 11, color: '#1B2A4A' },
  photo: { width: 76, height: 64, borderRadius: 8, backgroundColor: '#E7EDFF' }, error: { color: '#843828' },
});
