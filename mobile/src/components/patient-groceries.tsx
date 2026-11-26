import { useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { compareGroceryBranches, quoteGroceries, stores, type BranchPrice, type BranchProductPrice, type MarketPrice, type ProductPrice, type Store } from '@/lib/grocery-quote';
import { mealDate, shiftMealDate, type Meal } from '@/lib/patient-meals';
import { supabase } from '@/lib/supabase';
import { usePatient } from '@/lib/patient-session';
import { checkedPurchaseTotal, parsePurchaseCents, shiftPurchaseMonth } from '@/lib/grocery-checklist-core';
import { groceryChecklist, groceryChecklistPersistent } from '@/lib/grocery-checklist';
import { groceryPriceCache } from '@/lib/grocery-price-cache';
import { GroceryPriceNetworkError, loadGroceryPrices } from '@/lib/grocery-price-cache-core';
import { withRequestTimeout } from '@/lib/request-timeout';

const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const mxn = (cents: number) => money.format(cents / 100);
type Purchase = { id: string; purchased_on: string; store: string; branch: string; amount_cents: number };

export function PatientGroceries({ patientId, meals, day, onBack }: { patientId: string; meals: Meal[]; day: string; onBack: () => void }) {
  const { userId } = usePatient();
  const [period, setPeriod] = useState<'day' | 'week'>('week');
  const [store, setStore] = useState<Store>('Soriana');
  const [branch, setBranch] = useState('');
  const [selection, setSelection] = useState<{ store: Store; branch: string }>();
  const [branches, setBranches] = useState<{ store: Store; items: { branch: string; display_branch: string; municipality: string }[] }>();
  const [prices, setPrices] = useState<MarketPrice[]>([]);
  const [productPrices, setProductPrices] = useState<ProductPrice[]>([]);
  const [savedPrices, setSavedPrices] = useState<{ store: Store; branch: string; savedAt: string; offline: boolean }>();
  const [editing, setEditing] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<{ id: string; unit: 'g' | 'ml' } | null>(null);
  const [grams, setGrams] = useState('');
  const [price, setPrice] = useState('');
  const [bulk, setBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [comparison, setComparison] = useState<{ key: string; rows: ReturnType<typeof compareGroceryBranches> }>();
  const [comparing, setComparing] = useState(false);
  const [checked, setChecked] = useState<{ scope: string; keys?: string[]; error?: boolean }>();
  const [checkBusy, setCheckBusy] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseAttempt, setPurchaseAttempt] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [deletePurchaseId, setDeletePurchaseId] = useState<string | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<{ user: string; patient: string; month: string; rows?: Purchase[]; error?: boolean }>();
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const pendingPurchase = useRef<{ signature: string; id: string } | null>(null);
  const purchaseWrite = useRef(false);
  const checkWrite = useRef(false);
  const comparisonRequest = useRef(0);
  const selectionTouched = useRef(false);
  const comparisonKey = `${period}:${day}:${attempt}`;
  const quote = quoteGroceries(period === 'day' ? meals.filter((item) => item.meal_date === day) : meals, prices, productPrices);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const currentDate = mealDate();
  const currentMonth = currentDate.slice(0, 7);
  const viewedMonth = shiftPurchaseMonth(currentMonth, monthOffset);
  const checklistScope = `${period}_${period === 'week' ? shiftMealDate(day, -((weekday + 6) % 7)) : day}`;
  const viewScope = `${userId ?? ''}:${patientId}:${checklistScope}`;
  const activeChecklist = checked?.scope === viewScope ? checked : undefined;
  const selectedKeys = activeChecklist?.keys ?? [];
  const purchased = checkedPurchaseTotal([
    ...quote.items.map(item => ({ key: `food:${item.ingredient.id}`, purchase: item.purchase })),
    ...quote.products.map(item => ({ key: `product:${item.id}:${item.unit}`, purchase: item.purchase })),
  ], selectedKeys);
  const eaten = quote.mealsWithCost.filter(({ meal }) => meal.status === 'CONSUMED');
  const eatenCost = eaten.reduce((sum, item) => sum + (item.cost ?? 0), 0);
  const historical = quote.items.some((item) => item.price?.source === 'PROFECO');
  const storeBranches = branches?.store === store ? branches.items : [];

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void groceryPriceCache.read(userId, patientId).then(value => {
      if (active && value && !selectionTouched.current) {
        setStore(value.store); setBranch(value.branch); setSelection({ store: value.store, branch: value.branch });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [userId, patientId]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void groceryChecklist.read(userId, patientId, checklistScope)
      .then(keys => { if (active) setChecked({ scope: viewScope, keys }); })
      .catch(() => { if (active) setChecked({ scope: viewScope, error: true }); });
    return () => { active = false; };
  }, [userId, patientId, checklistScope, viewScope]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let active = true;
    const end = `${shiftPurchaseMonth(viewedMonth, 1)}-01`;
    void supabase.from('grocery_purchases').select('id,purchased_on,store,branch,amount_cents')
      .eq('patient_id', patientId).gte('purchased_on', `${viewedMonth}-01`).lt('purchased_on', end)
      .order('purchased_on', { ascending: false }).order('created_at', { ascending: false }).limit(201)
      .then(({ data, error }) => { if (active) setPurchaseHistory({ user: userId, patient: patientId, month: viewedMonth, rows: error ? undefined : data as Purchase[], error: Boolean(error) }); });
    return () => { active = false; };
  }, [patientId, userId, viewedMonth, purchaseAttempt]);

  async function savePurchase() {
    if (!supabase || !userId || !selection || purchaseWrite.current) return;
    const cents = parsePurchaseCents(purchaseAmount);
    if (cents === null) { setPurchaseMessage('Escribe el importe pagado en pesos y centavos.'); return; }
    const signature = JSON.stringify([patientId, currentDate, selection.store, selection.branch, cents]);
    if (pendingPurchase.current?.signature !== signature) pendingPurchase.current = { signature, id: randomUUID() };
    purchaseWrite.current = true; setPurchaseBusy(true); setPurchaseMessage('');
    try {
      const { error } = await supabase.rpc('record_grocery_purchase', { p_request_id: pendingPurchase.current.id,
        p_patient_id: patientId, p_day: currentDate, p_store: selection.store, p_branch: selection.branch, p_amount_cents: cents });
      if (error) throw error;
      pendingPurchase.current = null;
      setPurchaseAmount(''); setPurchaseMessage('Compra registrada.'); setMonthOffset(0); setPurchaseHistory(undefined); setPurchaseAttempt(value => value + 1);
    } catch { setPurchaseMessage('No se pudo confirmar la compra. Reintenta con los mismos datos para evitar duplicados.'); }
    finally { purchaseWrite.current = false; setPurchaseBusy(false); }
  }

  async function deletePurchase(id: string) {
    if (!supabase || !userId || deletingPurchase) return;
    setDeletingPurchase(true); setPurchaseMessage('');
    try {
      const { data, error } = await supabase.from('grocery_purchases').delete().eq('patient_id', patientId).eq('id', id).select('id');
      if (error || data.length !== 1) throw error ?? new Error('Compra no disponible');
      setDeletePurchaseId(null); setPurchaseHistory(undefined); setPurchaseAttempt(value => value + 1); setPurchaseMessage('Compra eliminada.');
    } catch { setPurchaseMessage('No se pudo confirmar la eliminación. Revisa el historial y vuelve a intentar.'); setPurchaseAttempt(value => value + 1); }
    finally { setDeletingPurchase(false); }
  }

  async function togglePurchased(key: string) {
    if (!userId || !activeChecklist?.keys || checkWrite.current) return;
    const next = selectedKeys.includes(key) ? selectedKeys.filter(item => item !== key) : [...selectedKeys, key];
    const scope = viewScope;
    checkWrite.current = true;
    setCheckBusy(true);
    try {
      await groceryChecklist.write(userId, patientId, checklistScope, next);
      setChecked(current => current?.scope === scope ? { scope, keys: next } : current);
    } catch { setError('No se pudo guardar la lista de compra en este dispositivo.'); }
    finally { checkWrite.current = false; setCheckBusy(false); }
  }

  async function compareStores() {
    if (!supabase || comparing) return;
    const selectedMeals = period === 'day' ? meals.filter(item => item.meal_date === day) : meals;
    const unpriced = quoteGroceries(selectedMeals, []);
    const ids = unpriced.items.map(item => item.ingredient.id);
    const productIds = [...new Set(unpriced.products.map(item => item.id))];
    if (!ids.length && !productIds.length) { setError('No hay ingredientes ni productos con cantidades para comparar.'); return; }
    const request = ++comparisonRequest.current;
    setComparing(true); setError('');
    const client = supabase;
    try {
      async function load(table: 'market_reference_prices' | 'market_prices') {
        if (!ids.length) return [];
        const rows: BranchPrice[] = [];
        for (let page = 0; page < 20; page++) {
          const fields = table === 'market_reference_prices' ? 'store,branch,display_branch,municipality,ingredient_id,pack_grams,pack_price,sold_by_weight,observed_on' : 'store,branch,ingredient_id,pack_grams,pack_price,sold_by_weight,observed_on';
          const { data, error: queryError } = await client!.from(table).select(fields).in('ingredient_id', ids)
            .order('store').order('branch').order('ingredient_id').range(page * 500, page * 500 + 499);
          if (queryError) throw queryError;
          rows.push(...data as unknown as BranchPrice[]);
          if (data.length < 500) return rows;
        }
        throw new Error('Demasiados precios para comparar.');
      }
      async function loadProducts() {
        if (!productIds.length) return [];
        const rows: BranchProductPrice[] = [];
        for (let page = 0; page < 20; page++) {
          const { data, error: queryError } = await client!.from('market_product_prices').select('store,branch,product_id,unit,pack_amount,pack_price,observed_on')
            .in('product_id', productIds).order('store').order('branch').order('product_id').order('unit').range(page * 500, page * 500 + 499);
          if (queryError) throw queryError;
          rows.push(...data as BranchProductPrice[]);
          if (data.length < 500) return rows;
        }
        throw new Error('Demasiados precios para comparar.');
      }
      const [reference, personal, products] = await Promise.all([load('market_reference_prices'), load('market_prices'), loadProducts()]);
      if (comparisonRequest.current === request) setComparison({ key: comparisonKey, rows: compareGroceryBranches(selectedMeals, reference, personal, products) });
    } catch { if (comparisonRequest.current === request) setError('No se pudieron comparar las sucursales. Revisa la conexión y vuelve a intentar.'); }
    finally { if (comparisonRequest.current === request) setComparing(false); }
  }

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
    if (!selection || !supabase || !userId) return;
    let active = true;
    const fields = 'ingredient_id,pack_grams,pack_price,sold_by_weight,observed_on';
    const client = supabase;
    void loadGroceryPrices(groceryPriceCache, userId, patientId, selection.store, selection.branch, async () => {
      async function pages<T>(query: (from: number, to: number, signal: AbortSignal) => PromiseLike<{ data: T[] | null; error: unknown; status: number }>) {
        const all: T[] = [];
        for (let page = 0; page < 20; page++) {
          const result = await withRequestTimeout(signal => query(page * 500, page * 500 + 499, signal));
          if (result.error) {
            if (result.status === 0) throw new GroceryPriceNetworkError('Sin conexión');
            throw new Error('No se pudieron consultar los precios.');
          }
          const rows = result.data ?? [];
          all.push(...rows);
          if (rows.length < 500) return all;
        }
        throw new Error('Demasiados precios para consultar.');
      }
      const results = await Promise.allSettled([
        pages((from, to, signal) => client.from('market_reference_prices').select(`${fields},presentation,brand`).eq('store', selection.store).eq('branch', selection.branch).order('ingredient_id').range(from, to).abortSignal(signal)),
        pages((from, to, signal) => client.from('market_prices').select(fields).eq('store', selection.store).eq('branch', selection.branch).order('ingredient_id').range(from, to).abortSignal(signal)),
        pages((from, to, signal) => client.from('market_product_prices').select('product_id,unit,pack_amount,pack_price,observed_on').eq('store', selection.store).eq('branch', selection.branch).order('product_id').order('unit').range(from, to).abortSignal(signal)),
      ]);
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.some(result => result.status === 'rejected' && !(result.reason instanceof GroceryPriceNetworkError))) throw new Error('No se pudieron consultar los precios.');
      if (failures.length) throw new GroceryPriceNetworkError('Sin conexión');
      const [reference, personal, products] = results.map(result => result.status === 'fulfilled' ? result.value : []) as [MarketPrice[], MarketPrice[], ProductPrice[]];
      const merged = new Map(reference.map((item) => [item.ingredient_id, { ...item, source: 'PROFECO' } as MarketPrice]));
      for (const item of personal) merged.set(item.ingredient_id, { ...item, source: 'personal' });
      return { prices: [...merged.values()], products: products as ProductPrice[] };
    }).then(value => {
      if (!active) return;
      setPrices(value.prices); setProductPrices(value.products);
      setSavedPrices({ store: value.store, branch: value.branch, savedAt: value.savedAt, offline: value.offline });
    }).catch(() => { if (active) { setPrices([]); setProductPrices([]); setSavedPrices(undefined); setError('No pudimos consultar los precios de esa sucursal.'); } });
    return () => { active = false; };
  }, [selection, attempt, userId, patientId]);

  function changeStore(value: Store) {
    selectionTouched.current = true;
    setStore(value);
    setBranch('');
    setSelection(undefined);
    setPrices([]);
    setProductPrices([]);
    setSavedPrices(undefined);
    setEditing(null);
    setEditingProduct(null);
    setError('');
  }

  function consult(value: string) {
    selectionTouched.current = true;
    const name = value.trim().toLowerCase();
    if (!name) { setError('Indica el nombre o código de la sucursal.'); return; }
    setError('');
    setEditing(null);
    setEditingProduct(null);
    setPrices([]);
    setProductPrices([]);
    setSavedPrices(undefined);
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

  async function saveProductPrice() {
    if (!supabase || !selection || !editingProduct || busy) return;
    const amount = Number(grams.trim().replace(',', '.'));
    const cost = Number(price.trim().replace(',', '.'));
    if (!Number.isFinite(amount) || amount < .01 || amount > 100000 || !Number.isFinite(cost) || cost < .01 || cost > 100000) {
      setError('Revisa la cantidad de la presentación y el precio en pesos.'); return;
    }
    setBusy(true); setError('');
    try {
      const { error } = await supabase.rpc('save_market_product_price', { p_store: selection.store, p_branch: selection.branch,
        p_product_id: editingProduct.id, p_unit: editingProduct.unit, p_amount: amount, p_price: cost });
      if (error) throw error;
      setEditingProduct(null); setAttempt(value => value + 1);
    } catch { setError('No pudimos guardar el precio. Revisa la conexión y vuelve a intentar.'); }
    finally { setBusy(false); }
  }

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
    <Button label="Volver a Dietas" onPress={onBack} />
    <Text accessibilityRole="header" style={s.title}>Despensa en Tlaxcala</Text>
    <View style={s.row}>
      <Button label="Día seleccionado" selected={period === 'day'} onPress={() => setPeriod('day')} />
      <Button label="Semana del menú" selected={period === 'week'} onPress={() => setPeriod('week')} />
    </View>
    <Button label={comparing ? 'Comparando…' : 'Comparar sucursales con precios disponibles'} disabled={comparing} onPress={() => void compareStores()} />
    {comparison?.key === comparisonKey && <View style={s.card}>
      <Text style={s.heading}>Comparación de la {period === 'day' ? 'dieta del día' : 'semana'}</Text>
      <Text style={s.body}>Los precios de referencia son históricos y los personales son los que registraste. Una sucursal incompleta no se clasifica como la más económica.</Text>
      {comparison.rows.length === 0 && <Text style={s.body}>No hay precios disponibles para estos ingredientes.</Text>}
      {comparison.rows.map(row => <Pressable key={`${row.store}:${row.branch}`} accessibilityRole="button" onPress={() => { selectionTouched.current = true; setStore(row.store); setBranch(row.display); setSelection({ store: row.store, branch: row.branch }); setEditing(null); setEditingProduct(null); setPrices([]); setProductPrices([]); setSavedPrices(undefined); setError(''); }}>
        <Text style={s.heading}>{row.store} · {row.display}</Text>
        <Text style={s.body}>{row.quote.complete ? 'Total estimado' : 'Subtotal parcial'} · {mxn(row.quote.purchase)} · {row.quote.items.length - row.quote.missing}/{row.quote.items.length} ingredientes{row.quote.missingProducts ? ` · ${row.quote.missingProducts} productos sin precio` : ''}{row.quote.manualMeals ? ` · ${row.quote.manualMeals} comidas sin desglose` : ''}</Text>
      </Pressable>)}
    </View>}
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
    {savedPrices?.offline && selection?.store === savedPrices.store && selection.branch === savedPrices.branch && <Text accessibilityLiveRegion="polite" style={s.body}>Sin conexión: precios guardados el {new Date(savedPrices.savedAt).toLocaleString('es-MX')}. Pueden haber cambiado; cada artículo muestra su fecha de observación.</Text>}
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Registrar compra realizada</Text>
      <Text style={s.body}>Captura lo que pagaste hoy. Este registro es independiente de los precios estimados y de los artículos marcados.</Text>
      <TextInput accessibilityLabel="Importe pagado en pesos" placeholder="Importe pagado en MXN" keyboardType="decimal-pad" value={purchaseAmount} onChangeText={setPurchaseAmount} editable={!purchaseBusy} style={s.input} />
      <Button label={purchaseBusy ? 'Guardando…' : 'Guardar compra'} disabled={!selection || purchaseBusy} onPress={() => void savePurchase()} />
      {!selection && <Text style={s.body}>Selecciona una sucursal para registrar la compra.</Text>}
      {purchaseMessage ? <Text accessibilityLiveRegion="polite" style={s.body}>{purchaseMessage}</Text> : null}
    </View>
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.heading}>Compras de {viewedMonth}</Text>
      <View style={s.row}>
        <Button label="Mes anterior" disabled={viewedMonth <= '2000-01' || deletingPurchase} onPress={() => { setDeletePurchaseId(null); setMonthOffset(value => value - 1); }} />
        <Button label="Mes actual" disabled={monthOffset === 0 || deletingPurchase} onPress={() => { setDeletePurchaseId(null); setMonthOffset(0); }} />
        <Button label="Mes siguiente" disabled={monthOffset >= 0 || deletingPurchase} onPress={() => { setDeletePurchaseId(null); setMonthOffset(value => value + 1); }} />
      </View>
      {purchaseHistory?.patient === patientId && purchaseHistory.user === userId && purchaseHistory.month === viewedMonth ? purchaseHistory.error
        ? <><Text style={s.error}>No se pudo consultar el historial.</Text><Button label="Reintentar historial" onPress={() => setPurchaseAttempt(value => value + 1)} /></>
        : <>
          <Text style={s.body}>{purchaseHistory.rows!.length > 200 ? 'Subtotal de las 200 compras más recientes' : 'Total registrado del mes'} · {mxn(purchaseHistory.rows!.slice(0, 200).reduce((sum, row) => sum + row.amount_cents, 0))}</Text>
          {purchaseHistory.rows!.length === 0 && <Text style={s.body}>No hay compras registradas este mes.</Text>}
          {purchaseHistory.rows!.slice(0, 200).map(row => <View key={row.id} style={s.card}>
            <Text style={s.body}>{row.purchased_on} · {row.store} · {row.branch} · {mxn(row.amount_cents)}</Text>
            {deletePurchaseId === row.id ? <View style={s.row}>
              <Text style={s.body}>¿Eliminar este registro?</Text>
              <Button label={deletingPurchase ? 'Eliminando…' : 'Confirmar eliminación'} disabled={deletingPurchase} onPress={() => void deletePurchase(row.id)} />
              <Button label="Cancelar" disabled={deletingPurchase} onPress={() => setDeletePurchaseId(null)} />
            </View> : <Button label="Eliminar registro" disabled={deletingPurchase} onPress={() => setDeletePurchaseId(row.id)} />}
          </View>)}
        </> : <Text style={s.body}>Cargando historial…</Text>}
    </View>
    {historical && <Text style={s.body}>El cálculo usa referencias históricas de Profeco. Cada ingrediente indica su fecha de observación.</Text>}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {(quote.items.length > 0 || quote.products.length > 0) && <View style={s.card}>
      <Text style={s.heading}>{quote.complete ? 'Total estimado de la despensa' : 'Subtotal de artículos con precio'} · {mxn(quote.purchase)}</Text>
      <Text style={s.body}>Costo de la cantidad usada {mxn(quote.consumed)}. La despensa incluye las presentaciones completas necesarias.</Text>
      {eaten.length > 0 && <Text style={s.body}>{eaten.some(({ cost }) => cost === null) ? 'Subtotal consumido con precio' : 'Costo de las comidas consumidas del plan'} · {mxn(eatenCost)}</Text>}
      {quote.missing > 0 && <Text style={s.body}>Ingredientes por cotizar: {quote.missing}.</Text>}
      <Text style={s.body}>Comprados: {purchased.count} · {purchased.missing ? 'Subtotal con precio' : 'Costo estimado'} {mxn(purchased.known)}{purchased.missing ? ` · ${purchased.missing} sin precio` : ''}.</Text>
      <Text style={s.body}>{groceryChecklistPersistent ? 'Lista guardada en este dispositivo.' : 'Lista disponible mientras esta página permanezca abierta.'} El importe usa los precios de la sucursal seleccionada.</Text>
      {!activeChecklist && <Text style={s.body}>{userId ? 'Cargando lista de compra…' : 'Inicia sesión para usar la lista de compra.'}</Text>}
      {activeChecklist?.error && <Text accessibilityRole="alert" style={s.error}>No se pudo abrir la lista guardada en este dispositivo.</Text>}
    </View>}
    {quote.manualMeals > 0 && <Text style={s.body}>Comidas con gramajes del catálogo pendientes: {quote.manualMeals}.</Text>}
    {quote.missingProducts > 0 && <Text style={s.body}>Productos comerciales por cotizar: {quote.missingProducts}. No se incluyen en el subtotal.</Text>}
    {quote.mealsWithCost.length === 0 && <Text style={s.body}>Aún no hay comidas asignadas en este periodo.</Text>}
    {quote.items.map(({ ingredient, price: stored, purchase, packages }) => <View key={ingredient.id} style={s.card}>
      {ingredient.photo_url && <Image source={{ uri: ingredient.photo_url }} accessibilityLabel={ingredient.name} style={s.photo} />}
      <Text style={s.heading}>{ingredient.name} · {ingredient.grams} g</Text>
      <Button label={selectedKeys.includes(`food:${ingredient.id}`) ? '✓ Comprado' : 'Marcar como comprado'} selected={selectedKeys.includes(`food:${ingredient.id}`)} disabled={!activeChecklist?.keys || checkBusy} onPress={() => void togglePurchased(`food:${ingredient.id}`)} />
      {stored && purchase !== null
        ? <Text style={s.body}>{mxn(Math.round(stored.pack_price * 100))} por {stored.pack_grams} g · {stored.observed_on}{packages !== null ? ` · ${packages} presentaciones` : ' · A granel'} · Compra {mxn(purchase)}</Text>
        : <Text style={s.body}>Sin precio para la sucursal seleccionada.</Text>}
      {stored?.source === 'PROFECO' && <Text style={s.body}>Profeco · {stored.presentation} · {stored.brand}</Text>}
      {stored?.source === 'personal' && <Text style={s.body}>Precio capturado por ti</Text>}
      {selection && editing !== ingredient.id && <Button label={stored?.source === 'personal' ? `Editar precio de ${ingredient.name}` : `Capturar precio de ${ingredient.name}`}
        disabled={busy} onPress={() => { setEditingProduct(null); setEditing(ingredient.id); setBulk(stored?.sold_by_weight ?? false); setGrams(stored?.pack_grams.toString() ?? ''); setPrice(stored?.pack_price.toString() ?? ''); }} />}
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
    {quote.products.map(product => <View key={`${product.id}:${product.unit}`} style={s.card}>
      {product.photo_url && <Image source={{ uri: product.photo_url }} accessibilityLabel={product.name} style={s.photo} />}
      <Text style={s.heading}>{product.name} · {product.amount} {product.unit}</Text>
      <Button label={selectedKeys.includes(`product:${product.id}:${product.unit}`) ? '✓ Comprado' : 'Marcar como comprado'} selected={selectedKeys.includes(`product:${product.id}:${product.unit}`)} disabled={!activeChecklist?.keys || checkBusy} onPress={() => void togglePurchased(`product:${product.id}:${product.unit}`)} />
      <Text style={s.body}>{product.brand || 'Marca no disponible'} · {product.price && product.purchase !== null ? `${mxn(Math.round(product.price.pack_price * 100))} por ${product.price.pack_amount} ${product.unit} · ${product.packages} presentación(es) · Compra ${mxn(product.purchase)} · ${product.price.observed_on}` : 'Precio pendiente'}</Text>
      {selection && !(editingProduct?.id === product.id && editingProduct.unit === product.unit) && <Button disabled={busy} label={`${product.price ? 'Editar' : 'Capturar'} precio de ${product.name}`} onPress={() => { setEditing(null); setEditingProduct({ id: product.id, unit: product.unit }); setGrams(product.price?.pack_amount.toString() ?? ''); setPrice(product.price?.pack_price.toString() ?? ''); }} />}
      {editingProduct?.id === product.id && editingProduct.unit === product.unit && <>
        <TextInput accessibilityLabel={`Cantidad por presentación en ${product.unit}`} placeholder={`Cantidad por presentación (${product.unit})`} keyboardType="decimal-pad" value={grams} onChangeText={setGrams} editable={!busy} style={s.input} />
        <TextInput accessibilityLabel="Precio de la presentación en pesos" placeholder="Precio de la presentación en MXN" keyboardType="decimal-pad" value={price} onChangeText={setPrice} editable={!busy} style={s.input} />
        <Button label={busy ? 'Guardando…' : 'Guardar precio'} onPress={() => void saveProductPrice()} disabled={busy} />
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
