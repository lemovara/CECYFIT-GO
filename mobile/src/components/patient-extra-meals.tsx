import { useCallback, useEffect, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { correctExtraMeal, deleteExtraMeal, mealDate, mealSaveError, readExtraMeals, saveExtraMeal, searchExtraFoods, searchExtraProducts, type ExtraMeal, type Meal } from '@/lib/patient-meals';
import { MealNetworkError } from '@/lib/meal-plan-cache-core';
import { searchCachedMeals } from '@/lib/food-search-terms';
import { estimateFood, estimateProduct, estimateRecipe, withIntakeTime, type CatalogItem, type CatalogProduct, type FoodSnapshot } from '@/lib/extra-food';
import { usePatient } from '@/lib/patient-session';
import { enqueueExtraMeal, listPendingExtraMeals, offlineStorageAvailable, subscribeExtraMealQueue, syncPendingExtraMeals, type PendingExtraMeal } from '@/lib/extra-meal-queue';

export function PatientExtraMeals({ patientId, day, onBack, backLabel = 'Volver a Dietas', cachedMeals }: {
  patientId: string; day: string; onBack: () => void; backLabel?: string; cachedMeals?: Meal[];
}) {
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [calories, setCalories] = useState('');
  const [consumedTime, setConsumedTime] = useState('');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<{ term: string; loading: boolean; results: CatalogItem[]; error: string }>();
  const [food, setFood] = useState<CatalogItem | null>(null);
  const [productUnit, setProductUnit] = useState<'' | 'g' | 'ml'>('');
  const [external, setExternal] = useState<{ term: string; page: number; loading: boolean; items: CatalogProduct[]; hasMore: boolean; error: string; stale?: boolean; savedAt?: string }>();
  const externalRequest = useRef(0);
  const [grams, setGrams] = useState('100');
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<{ id: string; revision: number; name: string; portion: string; calories: string }>();
  const [correcting, setCorrecting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ attempt: number; entries?: ExtraMeal[]; pending?: PendingExtraMeal[]; localError?: boolean; remoteDone: boolean }>();
  const { userId } = usePatient();
  const request = useRef<ExtraMeal | null>(null);
  const inFlight = useRef(false);
  const current = result?.attempt === attempt ? result : undefined;
  const canAdd = day <= mealDate();

  useEffect(() => {
    let active = true;
    if (food || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      setSearch({ term: query, loading: true, results: [], error: '' });
      void searchExtraFoods(query).then(({ items, partial }) => { if (active) setSearch({ term: query, loading: false, results: items, error: partial ? 'Una parte del catálogo no está disponible.' : '' }); })
        .catch(error => { if (active) {
          const offlineResults = error instanceof MealNetworkError ? searchCachedMeals(cachedMeals ?? [], query) : [];
          setSearch({ term: query, loading: false, results: offlineResults, error: offlineResults.length ? 'Sin conexión: se muestran comidas asignadas guardadas para esta semana.' : 'No se pudo buscar. Puedes escribir un alimento manualmente.' });
        } });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
  }, [query, food, cachedMeals]);

  const currentSearch = search?.term === query ? search : undefined;
  const searching = query.trim().length >= 2 && (!currentSearch || currentSearch.loading);
  const results = query.trim().length >= 2 ? currentSearch?.results ?? [] : [];
  const searchError = query.trim().length >= 2 ? currentSearch?.error ?? '' : '';

  let estimate: FoodSnapshot | undefined;
  if (food) { try {
    const quantity = Number(grams.replace(',', '.'));
    estimate = food.kind === 'recipe' ? estimateRecipe(food, quantity) : food.kind === 'product'
      ? productUnit ? estimateProduct(food, quantity, productUnit) : undefined : estimateFood(food, quantity);
  } catch { /* The user can correct the quantity. */ } }

  async function searchProducts(page: number) {
    const term = query.trim();
    if (term.length < 2 || term.length > 80 || external?.loading) return;
    const requestId = ++externalRequest.current;
    setExternal({ term, page, loading: true, items: [], hasMore: false, error: '' });
    try {
      const response = await searchExtraProducts(term, page);
      if (externalRequest.current === requestId) setExternal({ term, page, loading: false, ...response, error: '' });
    } catch {
      if (externalRequest.current === requestId) setExternal({ term, page, loading: false, items: [], hasMore: false, error: 'No se pudieron consultar productos. El catálogo local sigue disponible.' });
    }
  }

  async function removeConfirmed(id: string) {
    if (deleting || !userId || !current?.pending || current.localError || !current.entries?.some(entry => entry.id === id) || current.pending.some(entry => entry.id === id)) return;
    setDeleting(true); setError(''); setMessage('');
    try {
      await deleteExtraMeal(patientId, day, id);
      setDeleteId(null); setMessage('Registro eliminado.'); setAttempt(value => value + 1);
    } catch {
      setError('No se pudo confirmar la eliminación. Actualiza los registros antes de volver a intentar.'); setAttempt(value => value + 1);
    } finally { setDeleting(false); }
  }

  async function correctConfirmed() {
    if (!editing || correcting || deleting || !userId || !current?.pending || current.localError || current.pending.some(entry => entry.id === editing.id)) return;
    const kcalText = editing.calories.trim();
    if (!editing.name.trim() || !editing.portion.trim() || (kcalText && (!/^\d+$/.test(kcalText) || Number(kcalText) > 10000))) {
      setError('Revisa el alimento, la cantidad y las calorías.'); return;
    }
    setCorrecting(true); setError(''); setMessage('');
    try {
      await correctExtraMeal(patientId, { id: editing.id, revision: editing.revision, name: editing.name.trim(),
        portion: editing.portion.trim(), kcal: kcalText ? Number(kcalText) : null });
      setEditing(undefined); setMessage('Registro corregido.'); setAttempt(value => value + 1);
    } catch {
      setEditing(undefined); setError('No se pudo confirmar la corrección o el registro cambió. Revisa los datos actualizados.'); setAttempt(value => value + 1);
    } finally { setCorrecting(false); }
  }

  useEffect(() => subscribeExtraMealQueue(() => { setMessage(''); setAttempt(value => value + 1); }), []);

  useFocusEffect(useCallback(() => {
    let active = true;
    let entries: ExtraMeal[] | undefined;
    let pending: PendingExtraMeal[] | undefined;
    let localError = false;
    let remoteDone = false;
    const update = () => { if (active) setResult({ attempt, entries, pending, localError, remoteDone }); };
    void readExtraMeals(patientId, day).then(value => { entries = value; }).catch(() => {}).finally(() => { remoteDone = true; update(); });
    if (offlineStorageAvailable && userId) {
      void listPendingExtraMeals(userId, patientId).then(value => { pending = value.filter(entry => entry.day === day); })
        .catch(() => { localError = true; }).finally(update);
    } else { pending = []; update(); }
    return () => { active = false; };
  }, [patientId, day, attempt, userId]));

  async function save() {
    if (!canAdd || inFlight.current) return;
    const dish = food ? food.name.slice(0, 120) : name.trim();
    const amount = food && estimate ? food.kind === 'recipe' ? `${estimate.recipes} receta(s)`
      : food.kind === 'product' ? `${estimate.amount} ${estimate.unit}` : `${estimate.grams} g` : portion.trim();
    const kcal = food ? (estimate?.kcal == null ? null : Math.round(estimate.kcal)) : calories.trim() ? Number(calories) : null;
    setMessage('');
    setError('');
    if (food && !estimate) { setError(food.kind === 'recipe' ? 'Indica una cantidad mayor que 0 y hasta 20 recetas.' : food.kind === 'product' && !productUnit ? 'Confirma si la etiqueta indica valores por 100 g o por 100 ml.' : 'Indica una cantidad mayor que 0 y hasta 5 000.'); return; }
    if (!dish || !amount) {
      setError('Escribe el alimento y la cantidad consumida.');
      return;
    }
    if (kcal !== null && ((!food && !/^\d+$/.test(calories.trim())) || !Number.isInteger(kcal) || kcal > 10000)) {
      setError('Escribe las calorías como un número entero entre 0 y 10 000.');
      return;
    }
    let snapshot: FoodSnapshot | undefined;
    try { snapshot = withIntakeTime(estimate, dish, kcal, consumedTime); }
    catch { setError('Escribe la hora en formato de 24 horas, por ejemplo 14:30.'); return; }
    const previous = request.current;
    const sameRequest = previous?.name === dish && previous.portion === amount && previous.kcal === kcal
      && JSON.stringify(previous.nutrition_snapshot ?? null) === JSON.stringify(snapshot ?? null);
    inFlight.current = true;
    setSaving(true);
    try {
      const entry = sameRequest ? previous : { id: randomUUID(), name: dish, portion: amount, kcal, ...(snapshot ? { nutrition_snapshot: snapshot } : {}) };
      request.current = entry;
      if (offlineStorageAvailable && userId) await enqueueExtraMeal(userId, { ...entry, patientId, day });
      else await saveExtraMeal(patientId, day, entry);
      request.current = null;
      setName('');
      setPortion('');
      setCalories('');
      setConsumedTime('');
      setFood(null);
      setQuery('');
      setGrams('100');
      setProductUnit('');
      setExternal(undefined);
      setMessage(offlineStorageAvailable && userId ? 'Guardado en este dispositivo. Pendiente de sincronización.' : 'Consumo guardado.');
      setAttempt((value) => value + 1);
      if (offlineStorageAvailable && userId) void syncPendingExtraMeals(userId, patientId).then(result => {
        if (result.pending === 0) setMessage('Consumo sincronizado.');
      }).catch(() => {});
    } catch (error) {
      setError(offlineStorageAvailable && userId ? 'No se pudo guardar de forma segura en el dispositivo. Inténtalo de nuevo.' : mealSaveError(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  const dateLabel = new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full', timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));

  return <SafeAreaView style={styles.safe}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={styles.link}>{backLabel}</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Comidas fuera del plan</Text>
      <Text style={styles.body}>{dateLabel}</Text>
      {canAdd && <View style={styles.card}>
        <Text style={styles.body}>Comparte lo que comiste para que tu profesional pueda revisarlo en el seguimiento.</Text>
        <Text style={styles.heading}>Buscar en el catálogo de alimentos</Text>
        {!food && <>
          <TextInput accessibilityLabel="Buscar alimento" value={query} onChangeText={value => { externalRequest.current++; setExternal(undefined); setQuery(value); }} placeholder="Ej. manzana, avena" maxLength={100} style={styles.input} />
          {searching && <ActivityIndicator accessibilityLabel="Buscando alimentos" />}
          {searchError ? <Text style={styles.error}>{searchError}</Text> : null}
          {!searching && query.trim().length >= 2 && !results.length && !searchError && <Text style={styles.body}>Sin ingredientes ni recetas para esta búsqueda. También puedes buscar productos o registrar el alimento manualmente.</Text>}
          {results.map(item => <Pressable key={`${item.kind}:${item.id}`} accessibilityRole="button" onPress={() => { setFood(item); setGrams(item.kind === 'recipe' ? '1' : '100'); setError(''); }} style={styles.searchResult}>
            {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.foodImage} />}
            <View style={{ flex: 1 }}><Text style={styles.heading}>{item.name}</Text><Text style={styles.body}>{item.kind === 'recipe' ? 'Receta completa' : 'Ingrediente · valores por 100 g'} · {item.kind === 'product' ? 'Open Food Facts' : item.source_name || 'Catálogo CECYFIT'}</Text></View>
          </Pressable>)}
          <Pressable accessibilityRole="button" disabled={query.trim().length < 2 || query.trim().length > 80 || external?.loading} onPress={() => void searchProducts(1)} style={styles.button}><Text style={styles.buttonText}>Buscar productos por nombre</Text></Pressable>
          <Text style={styles.body}>Esta búsqueda envía el texto a Open Food Facts. Escribe solo alimentos o marcas, sin datos personales.</Text>
          {external?.loading && <ActivityIndicator accessibilityLabel="Buscando productos" />}
          {external?.error ? <Text style={styles.error}>{external.error}</Text> : null}
          {external?.stale && <Text style={styles.body}>El proveedor no respondió. Mostramos resultados guardados{external.savedAt ? ` el ${new Date(external.savedAt).toLocaleString('es-MX')}` : ''}; revisa la etiqueta del producto.</Text>}
          {external && !external.loading && !external.error && external.items.length === 0 && <Text style={styles.body}>No se encontraron productos.</Text>}
          {external?.items.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => { setFood(item); setGrams('100'); setProductUnit(''); setError(''); }} style={styles.searchResult}>
            {item.photo_url && <Image source={{ uri: item.photo_url }} style={styles.foodImage} />}
            <View style={{ flex: 1 }}><Text style={styles.heading}>{item.name}</Text><Text style={styles.body}>{item.brand || 'Marca no disponible'} · {item.mexico === true ? 'Reportado para México' : 'Disponibilidad en México no confirmada'}</Text></View>
          </Pressable>)}
          {external && !external.loading && !external.error && <View style={styles.row}>
            <Pressable accessibilityRole="button" disabled={external.page === 1} onPress={() => void searchProducts(external.page - 1)}><Text style={styles.link}>Anterior</Text></Pressable>
            <Text style={styles.body}>Página {external.page}</Text>
            <Pressable accessibilityRole="button" disabled={!external.hasMore} onPress={() => void searchProducts(external.page + 1)}><Text style={styles.link}>Siguiente</Text></Pressable>
          </View>}
        </>}
        {food ? <>
          <Text style={styles.heading}>{food.name}</Text>
          <Text style={styles.body}>Fuente: {food.kind === 'product' ? 'Open Food Facts · datos comunitarios' : food.source_name || 'catálogo CECYFIT; datos de referencia'}</Text>
          <Pressable accessibilityRole="button" onPress={() => setFood(null)}><Text style={styles.link}>Elegir otro alimento o registrar manualmente</Text></Pressable>
          {food.kind === 'recipe' && <><Text style={styles.body}>{food.description}</Text><Text style={styles.heading}>Ingredientes de la receta completa</Text>{food.ingredients.map(item => <Text key={item.id} style={styles.body}>{item.name}: {item.grams} g</Text>)}<Text style={styles.body}>1 equivale a toda la receta mostrada; usa 0.5 para media receta.</Text></>}
          {food.kind === 'product' && <><Text style={styles.body}>{food.mexico === true ? 'Reportado para México por Open Food Facts.' : food.mexico === false ? 'Reportado para otros países; disponibilidad en México no confirmada.' : 'País de venta no informado.'}</Text>
            <Text style={styles.body}>Alérgenos reportados: {food.allergens?.length ? food.allergens.join(', ') : 'sin información disponible'}.</Text>
            <Text style={styles.body}>Trazas reportadas: {food.traces?.length ? food.traces.join(', ') : 'sin información disponible'}.</Text>
            {Boolean(food.labels?.length) && <Text style={styles.body}>Etiquetas del proveedor: {food.labels!.join(', ')}.</Text>}
            <Text style={styles.body}>Confirma la base y los alérgenos en la etiqueta del producto. Los datos pueden estar incompletos o desactualizados.</Text><View style={styles.row}>{(['g', 'ml'] as const).map(unit => <Pressable key={unit} accessibilityRole="button" accessibilityState={{ selected: productUnit === unit }} onPress={() => setProductUnit(unit)} style={[styles.button, productUnit === unit && styles.selectedUnit]}><Text style={styles.buttonText}>Por 100 {unit}</Text></Pressable>)}</View></>}
          <Text style={styles.heading}>{food.kind === 'recipe' ? 'Cantidad de recetas completas' : food.kind === 'product' ? `Cantidad consumida${productUnit ? ` (${productUnit})` : ''}` : 'Cantidad consumida (gramos)'}</Text>
          <TextInput accessibilityLabel={food.kind === 'recipe' ? 'Cantidad de recetas completas' : food.kind === 'product' ? 'Cantidad consumida' : 'Cantidad en gramos'} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" maxLength={8} style={styles.input} />
          {estimate && <NutritionDetails snapshot={estimate} />}
          <Text style={styles.body}>Estimación según el alimento y estado seleccionados. Verifica que correspondan a lo consumido.</Text>
        </> : <>
        <Text style={styles.heading}>Registro manual</Text>
        <Text style={styles.heading}>Alimento o platillo</Text>
        <TextInput accessibilityLabel="Alimento o platillo" value={name} onChangeText={setName}
          placeholder="Ej. Tacos de frijol" maxLength={120} editable={!saving} style={styles.input} />
        <Text style={styles.heading}>Cantidad consumida</Text>
        <TextInput accessibilityLabel="Cantidad consumida" value={portion} onChangeText={setPortion}
          placeholder="Ej. 2 piezas" maxLength={120} editable={!saving} style={styles.input} />
        <Text style={styles.heading}>Calorías (opcional)</Text>
        <TextInput accessibilityLabel="Calorías" value={calories} onChangeText={setCalories}
          keyboardType="number-pad" maxLength={5} editable={!saving} style={styles.input} />
        <Text style={styles.body}>Información escrita por ti, sin verificar.</Text>
        </>}
        <Text style={styles.heading}>Hora en que comiste (opcional)</Text>
        <TextInput accessibilityLabel="Hora de consumo, formato 24 horas" value={consumedTime} onChangeText={setConsumedTime} placeholder="Ej. 14:30" maxLength={5} editable={!saving} style={styles.input} />
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={[styles.button, saving && styles.disabled]}>
          <Text style={styles.buttonText}>{saving ? 'Guardando…' : 'Guardar consumo'}</Text>
        </Pressable>
      </View>}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text> : null}
      <Text accessibilityRole="header" style={styles.heading}>Registros de este día</Text>
      {(!current || !current.remoteDone) && <ActivityIndicator accessibilityLabel="Cargando registros del servidor" />}
      {current?.localError && <Text accessibilityRole="alert" style={styles.error}>No se pudieron leer los registros pendientes del dispositivo.</Text>}
      {current?.pending?.map(entry => <View key={`pending:${entry.id}`} style={styles.card}>
        <Text style={styles.heading}>{entry.name}</Text><Text style={styles.body}>{entry.portion}{entry.kcal !== null ? ` · ${entry.kcal} kcal` : ''}</Text>{entry.nutrition_snapshot && <NutritionDetails snapshot={entry.nutrition_snapshot} />}<Text style={styles.body}>Guardado en este dispositivo · pendiente de sincronización</Text>
      </View>)}
      {Boolean(current?.pending?.length && userId) && <Pressable accessibilityRole="button" onPress={() => { if (userId) void syncPendingExtraMeals(userId, patientId).then(result => setMessage(result.pending ? 'Hay registros pendientes; revisa tu conexión y vinculación y vuelve a intentar.' : 'Registros sincronizados.')).catch(() => setError('No se pudieron sincronizar los registros.')); }}><Text style={styles.link}>Reintentar sincronización</Text></Pressable>}
      {current?.remoteDone && !current.entries && <View style={styles.card}>
        <Text accessibilityRole="alert" style={styles.error}>No pudimos cargar los registros.</Text>
        <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)}><Text style={styles.link}>Reintentar</Text></Pressable>
      </View>}
      {current?.entries?.length === 0 && current?.pending?.length === 0 && <Text style={styles.body}>Aún no hay registros para este día.</Text>}
      {current?.entries?.filter(entry => !current.pending?.some(pending => pending.id === entry.id)).map((entry) => <View key={entry.id} style={styles.card}>
        <Text style={styles.heading}>{entry.name}</Text>
        <Text style={styles.body}>{entry.portion}{entry.kcal !== null ? ` · ${entry.kcal} kcal` : ''}</Text>
        {entry.nutrition_snapshot && <NutritionDetails snapshot={entry.nutrition_snapshot} />}
        {editing?.id === entry.id ? <View style={styles.card}>
          <Text style={styles.heading}>Corregir registro</Text>
          <TextInput accessibilityLabel="Nombre corregido" value={editing.name} maxLength={120} editable={!correcting} style={styles.input} onChangeText={name => setEditing(current => current && { ...current, name })} />
          <TextInput accessibilityLabel="Cantidad corregida" value={editing.portion} maxLength={120} editable={!correcting} style={styles.input} onChangeText={portion => setEditing(current => current && { ...current, portion })} />
          <TextInput accessibilityLabel="Calorías corregidas opcionales" value={editing.calories} keyboardType="number-pad" maxLength={5} editable={!correcting} style={styles.input} onChangeText={calories => setEditing(current => current && { ...current, calories })} placeholder="Calorías opcionales" />
          {entry.nutrition_snapshot && <Text style={styles.body}>Al corregir se quitarán el desglose nutricional, los alérgenos y la hora anteriores porque podrían no corresponder a los nuevos datos.</Text>}
          <View style={styles.row}><Pressable accessibilityRole="button" disabled={correcting} onPress={() => void correctConfirmed()}><Text style={styles.link}>{correcting ? 'Guardando…' : 'Guardar corrección'}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={correcting} onPress={() => setEditing(undefined)}><Text style={styles.link}>Cancelar</Text></Pressable></View>
        </View> : <Pressable accessibilityRole="button" disabled={deleting || correcting || !current.pending || current.localError || !Number.isInteger(entry.revision)} onPress={() => { setDeleteId(null); setEditing({ id: entry.id, revision: entry.revision!, name: entry.name, portion: entry.portion, calories: entry.kcal === null ? '' : String(entry.kcal) }); }}><Text style={styles.link}>Corregir registro</Text></Pressable>}
        {deleteId === entry.id ? <><Text style={styles.body}>¿Eliminar este registro?</Text><View style={styles.row}>
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => void removeConfirmed(entry.id)}><Text style={styles.link}>{deleting ? 'Eliminando…' : 'Confirmar eliminación'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={deleting} onPress={() => setDeleteId(null)}><Text style={styles.link}>Cancelar</Text></Pressable>
        </View></> : <Pressable accessibilityRole="button" disabled={deleting || correcting || !current.pending || current.localError} onPress={() => { setEditing(undefined); setDeleteId(entry.id); }}><Text style={styles.link}>Eliminar registro</Text></Pressable>}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

function NutritionDetails({ snapshot }: { snapshot: FoodSnapshot }) {
  const value = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? `${n} g` : 'No disponible';
  return <><Text style={styles.body}>Energía {typeof snapshot.kcal === 'number' && Number.isFinite(snapshot.kcal) ? `${snapshot.kcal} kcal` : 'No disponible'} · Proteína {value(snapshot.protein)} · Carbohidratos {value(snapshot.carbs)} · Grasas {value(snapshot.fat)} · Fibra {value(snapshot.fiber)}</Text>
    {snapshot.kind === 'product' && <><Text style={styles.body}>Alérgenos reportados: {Array.isArray(snapshot.allergens) && snapshot.allergens.length ? snapshot.allergens.join(', ') : 'sin información disponible'}.</Text>
      <Text style={styles.body}>Trazas reportadas: {Array.isArray(snapshot.traces) && snapshot.traces.length ? snapshot.traces.join(', ') : 'sin información disponible'}.</Text>
      {Array.isArray(snapshot.labels) && snapshot.labels.length > 0 && <Text style={styles.body}>Etiquetas reportadas: {snapshot.labels.join(', ')}.</Text>}</>}
    {typeof snapshot.consumed_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(snapshot.consumed_time) && <Text style={styles.body}>Hora declarada: {snapshot.consumed_time} · Ciudad de México</Text>}</>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F7FB' },
  content: { padding: 20, paddingBottom: 32, gap: 14 },
  title: { color: '#1B2A4A', fontSize: 27, fontWeight: '900' },
  heading: { color: '#1B2A4A', fontSize: 15, fontWeight: '800' },
  body: { color: '#526580', lineHeight: 20 },
  error: { color: '#9C3D35', lineHeight: 20 },
  link: { color: '#1C4DFF', fontWeight: '800', paddingVertical: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 15, padding: 14, gap: 10 },
  input: { borderWidth: 1, borderColor: '#D6DDEB', borderRadius: 10, color: '#1B2A4A', padding: 12 },
  searchResult: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#D6DDEB' },
  foodImage: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E7EDFF' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  selectedUnit: { backgroundColor: '#163AB5' },
  button: { backgroundColor: '#1C4DFF', borderRadius: 10, padding: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontWeight: '800' },
  disabled: { opacity: 0.55 },
});
