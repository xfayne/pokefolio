import { parseMoney, safeInteger, splitMoney } from './money';
import { prepareCommit, type PortfolioCommit, type PortfolioRecord } from './persistence';
import {
  cardCopySchema, catalogRefSchema, conditionSchema, currencySchema, dateSchema, idSchema,
  importedPurchaseLineSchema, importedPurchaseSchema, revisionSchema,
  shipmentMembershipSchema, type CatalogRef, type Condition, type Currency, type Cost, type ImportedPurchase,
} from './schema';

export type ImportedPurchaseEditCard = Readonly<{
  id: string; amount: string; currency: Currency;
  condition: Condition | 'unknown'; catalog: CatalogRef;
}>;
export type ImportedPurchaseEditDraft = Readonly<{
  id: string; date: string; notes: string; cards: readonly ImportedPurchaseEditCard[];
  // Set only by the shared transaction form after an explicit, single-currency edit.
  transactionCurrency?: Currency;
  source?: NonNullable<ImportedPurchase['source']>;
  shipping?: string;
  trackingNumber?: string; carrier?: string;
}>;

function purchaseEntries(records: readonly PortfolioRecord[], id: string) {
  const purchase = records.find(e => e.collection === 'transactions' && e.record.id === id);
  if (!purchase || purchase.collection !== 'transactions' || purchase.record.kind !== 'purchase' || !('origin' in purchase.record))
    throw Error('Imported purchase unavailable');
  const copies = records.filter(e => e.collection === 'copies' && e.record.acquisition.kind === 'purchase' &&
    e.record.acquisition.transactionId === id && !e.record.removedFromImport);
  const lines = records.filter(e => e.collection === 'lines' && e.record.transactionId === id && 'origin' in e.record);
  if (copies.some(copy => copy.collection !== 'copies' || copy.record.disposition !== 'held') ||
      copies.some(copy => !lines.some(line => line.collection === 'lines' && copy.collection === 'copies' &&
        copy.record.acquisition.kind === 'purchase' && line.record.id === copy.record.acquisition.lineId)))
    throw Error('Imported purchase copies cannot be edited');
  return { purchase, copies, lines };
}

export function importedPurchaseEditDraft(records: readonly PortfolioRecord[], id: string): ImportedPurchaseEditDraft {
  const { purchase, copies, lines } = purchaseEntries(records, id);
  const p = importedPurchaseSchema.parse(purchase.record);
  const lineOrder = new Map(lines.flatMap(line => line.collection === 'lines' && 'ordinal' in line.record
    ? [[line.record.id, line.record.ordinal] as const] : []));
  return {
    id, date: p.transactionOn.status === 'known' ? p.transactionOn.value : '', notes: p.notes,
    cards: [...copies].sort((a,b) => {
      if (a.collection !== 'copies' || b.collection !== 'copies' || a.record.acquisition.kind !== 'purchase' || b.record.acquisition.kind !== 'purchase') return 0;
      return (lineOrder.get(a.record.acquisition.lineId) ?? 0) - (lineOrder.get(b.record.acquisition.lineId) ?? 0);
    }).map(entry => {
      if (entry.collection !== 'copies') throw Error('Invalid imported copy');
      const cost = entry.record.cardCost;
      return {
        id: entry.record.id, catalog: entry.record.catalog,
        condition: entry.record.condition.status === 'known' ? entry.record.condition.value : 'unknown',
        amount: cost.status === 'exact' ? (cost.value.minor / 100).toFixed(2) : '',
        // Original per-copy currency is retained internally; there is no per-card currency picker.
        currency: cost.status === 'exact' ? cost.value.currency :
          p.currency.status === 'known' ? p.currency.value : p.nativeCardTotals?.[0]?.currency ?? 'USD',
      };
    }),
  };
}

function unchangedExcept(before: object, after: object, allowed: readonly string[]): boolean {
  const stable = (value: object) => JSON.stringify(Object.fromEntries(Object.entries(value)
    .filter(([key]) => !allowed.includes(key) && key !== 'revision' && key !== 'updatedAt')));
  return stable(before) === stable(after);
}
const stableTransaction = ['transactionOn', 'notes', 'subtotal', 'payable', 'currency', 'nativeCardTotals', 'unpricedCopyCount', 'shipping', 'shippingIncludedInCardPrices', 'totalBasis', 'source'];
const stableCopy = ['cardCost', 'shippingCost', 'condition', 'removedFromImport'];

export function validateImportedPurchaseEdit(command: PortfolioCommit): boolean {
  const transactions = command.updates.filter(u => u.before.collection === 'transactions' &&
    u.before.record.kind === 'purchase' && 'origin' in u.before.record);
  if (!transactions.length) return false;
  if (transactions.length !== 1) throw Error('Invalid imported purchase edit');
  const tx = transactions[0]!;
  if (tx.after.collection !== 'transactions' || !('origin' in tx.after.record) ||
      !unchangedExcept(tx.before.record, tx.after.record, stableTransaction))
    throw Error('Imported purchase source must be preserved');
  const txId = tx.before.record.id;
  const createdCopies = command.creates.filter(e => e.collection === 'copies');
  const createdLines = command.creates.filter(e => e.collection === 'lines');
  const createdShipments = command.creates.filter(e => e.collection === 'shipments');
  if (createdShipments.length > 1) throw Error('Only one new shipment can be added');
  for (const entry of command.creates) {
    if (entry.collection === 'revisions') continue;
    if (entry.collection === 'copies') {
      if (entry.record.acquisition.kind !== 'purchase' || entry.record.acquisition.transactionId !== txId ||
          entry.record.removedFromImport) throw Error('Invalid added imported copy');
    } else if (entry.collection === 'lines') {
      if (!('origin' in entry.record) || entry.record.transactionId !== txId) throw Error('Invalid added imported line');
    } else if (entry.collection === 'shipments') {
      if (!command.creates.some(e => e.collection === 'memberships' && e.record.shipmentId === entry.record.id))
        throw Error('New imported shipment needs matching membership');
    } else if (entry.collection === 'memberships') {
      const isNewCopy = createdCopies.some(copy => copy.collection === 'copies' && copy.record.id === entry.record.copyId);
      const isNewShipment = createdShipments.some(shipment => shipment.collection === 'shipments' && shipment.record.id === entry.record.shipmentId);
      if (entry.record.transactionId !== txId || (!isNewCopy && !isNewShipment))
        throw Error('Added shipment membership must belong to this purchase');
    } else throw Error('Imported edits cannot create unrelated records');
  }
  if (createdCopies.length !== createdLines.length || createdCopies.some(entry => {
    if (entry.collection !== 'copies' || entry.record.acquisition.kind !== 'purchase') return true;
    const lineId = entry.record.acquisition.lineId;
    return !createdLines.some(line => line.collection === 'lines' && 'catalog' in line.record && line.record.id === lineId &&
      JSON.stringify(line.record.catalog) === JSON.stringify(entry.record.catalog));
  }))
    throw Error('Every added imported copy must have its own line');
  const modifiedPriceLines = new Set<string>();
  for (const change of command.updates) {
    if (change === tx) continue;
    const { before, after } = change;
    if (before.collection === 'copies' && after.collection === 'copies') {
      if (before.record.acquisition.kind !== 'purchase' || before.record.acquisition.transactionId !== txId ||
          !unchangedExcept(before.record, after.record, stableCopy) ||
          (after.record.removedFromImport && !before.record.removedFromImport &&
            (JSON.stringify(before.record.cardCost) !== JSON.stringify(after.record.cardCost) ||
             JSON.stringify(before.record.condition) !== JSON.stringify(after.record.condition))))
        throw Error('Imported copy dates, references and identity must be preserved');
      if (JSON.stringify(before.record.shippingCost) !== JSON.stringify(after.record.shippingCost)) {
        const shipping = after.record.shippingCost;
        if (shipping.status !== 'exact' ||
            (after.record.cardCost.status === 'exact' && shipping.value.currency !== after.record.cardCost.value.currency))
          throw Error('Imported shipping correction must match the card currency');
        if (shipping.value.minor > 0 &&
            (tx.after.record.shipping.status !== 'known' ||
             tx.after.record.shipping.value.currency !== shipping.value.currency ||
             tx.after.record.totalBasis !== 'owner-confirmed-total'))
          throw Error('Allocated shipping must have a confirmed transaction total');
      }
      const priceChanged = JSON.stringify(before.record.cardCost) !== JSON.stringify(after.record.cardCost);
      const lineId = before.record.acquisition.lineId;
      const line = command.updates.find(u => u.before.collection === 'lines' && u.before.record.id === lineId);
      if (priceChanged !== !!line) throw Error('Imported price and purchase line must update together');
      if (line && line.after.collection === 'lines' && 'origin' in line.after.record) {
        const cost = after.record.cardCost, evidence = line.after.record.pricing.unitPrice;
        if (cost.status === 'exact' ? evidence.status !== 'known' ||
          evidence.value.minor !== cost.value.minor || evidence.value.currency !== cost.value.currency :
          evidence.status !== 'unknown') throw Error('Imported copy cost and line disagree');
        modifiedPriceLines.add(lineId);
      }
    } else if (before.collection === 'lines' && after.collection === 'lines') {
      if (!('origin' in before.record) || !('origin' in after.record) || before.record.transactionId !== txId ||
          !unchangedExcept(before.record, after.record, ['pricing']))
        throw Error('Imported purchase line identity cannot change');
    } else if (before.collection === 'shipments' && after.collection === 'shipments') {
      if (!unchangedExcept(before.record, after.record, ['carrier','trackingNumber','tracking']))
        throw Error('Shipment provenance and delivery cannot change');
    } else throw Error('Imported edits cannot modify unrelated records');
  }
  const updatedLines = command.updates.filter(u => u.before.collection === 'lines');
  if (updatedLines.length !== modifiedPriceLines.size) throw Error('Unpaired imported price update');
  return true;
}

export function importedPurchaseEditCommit(owner: string, input: ImportedPurchaseEditDraft, at: string, records: readonly PortfolioRecord[]): PortfolioCommit | null {
  idSchema.parse(owner);
  const { purchase, copies, lines } = purchaseEntries(records, idSchema.parse(input.id));
  if (purchase.record.ownerUid !== owner || copies.some(e => e.record.ownerUid !== owner)) throw Error('Owner mismatch');
  const before = importedPurchaseSchema.parse(purchase.record);
  if (input.notes.length > 2000 || new Set(input.cards.map(c=>c.id)).size !== input.cards.length)
    throw Error('Invalid imported edit');
  if (input.transactionCurrency && (input.cards.some(card=>card.currency!==input.transactionCurrency || !card.amount.trim())))
    throw Error('All imported card prices must match the selected transaction currency');
  const enteredShipping = input.shipping !== undefined
    ? parseMoney(input.shipping.trim() || '0', input.transactionCurrency ??
      (before.currency.status==='known' ? before.currency.value : 'USD'))
    : null;
  // A user-confirmed purchase explicitly separates card prices and shipping.
  // The original import's included-shipping evidence remains in the audit.
  const shippingAllocation = enteredShipping && input.cards.length
    ? splitMoney(enteredShipping, input.cards.map(card=>card.id))
    : null;
  const date = input.date.trim();
  if (date && !dateSchema.safeParse(date).success) throw Error('Invalid purchase date');
  const updateAt = new Date(at).toISOString();
  const updates: PortfolioCommit['updates'] = [];
  const creates: PortfolioCommit['creates'] = [];
  const nextCosts: Cost[] = [];
  let membershipChanged = false;
  function audited(beforeEntry: PortfolioRecord, afterEntry: PortfolioRecord) {
    updates.push({before: beforeEntry, after: afterEntry});
    creates.push({collection:'revisions',record:revisionSchema.parse({
      schemaVersion:1,id:'audit-'+crypto.randomUUID(),ownerUid:owner,actorUid:owner,
      revision:1,createdAt:updateAt,updatedAt:updateAt,recordId:beforeEntry.record.id,
      operation:'edit',reason:'Imported purchase correction',before:beforeEntry.record,after:afterEntry.record,
    })});
  }
  const originalIds = new Set(copies.map(e=>e.record.id));
  const allCopyIds = new Set(records.filter(e=>e.collection==='copies').map(e=>e.record.id));
  if (input.cards.some(field => !originalIds.has(field.id) && allCopyIds.has(field.id)))
    throw Error('Cannot re-use an existing physical copy ID');
  for (const entry of copies) {
    if (entry.collection !== 'copies' || entry.record.acquisition.kind !== 'purchase') throw Error('Invalid imported copy');
    const field = input.cards.find(card => card.id === entry.record.id);
    if (!field) {
      audited(entry, {collection:'copies',record:cardCopySchema.parse({
        ...entry.record,removedFromImport:true,revision:entry.record.revision+1,updatedAt:updateAt,
      })});
      membershipChanged = true;
      continue;
    }
    // Editing a price never silently converts the original currency or catalog identity.
    if (JSON.stringify(catalogRefSchema.parse(field.catalog)) !== JSON.stringify(entry.record.catalog))
      throw Error('Use card selection to add a different card');
    const originalCurrency = entry.record.cardCost.status === 'exact' ? entry.record.cardCost.value.currency : field.currency;
    if (!input.transactionCurrency && currencySchema.parse(field.currency) !== originalCurrency)
      throw Error('Original card currency cannot be changed');
    const editedCurrency = input.transactionCurrency ?? originalCurrency;
    const parsed = field.amount.trim() ? parseMoney(field.amount.trim(), editedCurrency) : null;
    const old = entry.record.cardCost;
    const sameCost = parsed ? old.status === 'exact' && old.value.minor === parsed.minor &&
      old.value.currency === parsed.currency : old.status === 'unknown';
    const cost: Cost = sameCost ? old : parsed ? {status:'exact',value:parsed,evidenceRef:before.id} :
      {status:'unknown',reason:'Price cleared by owner'};
    const nextCondition = conditionSchema.safeParse(field.condition).success
      ? entry.record.condition.status === 'known' && entry.record.condition.value === field.condition ? entry.record.condition :
        {status:'known' as const,value:conditionSchema.parse(field.condition),source:'user' as const}
      : field.condition === 'unknown' ? entry.record.condition.status === 'unknown' ? entry.record.condition :
        {status:'unknown' as const,reason:'Condition cleared by owner'} : (()=>{throw Error('Invalid condition')})();
    const allocated = shippingAllocation?.get(entry.record.id);
    const shippingCost: Cost = allocated
      ? {status:'exact',value:allocated,evidenceRef:before.id}
      : entry.record.shippingCost.status === 'exact' && entry.record.shippingCost.value.minor === 0 && parsed
        ? {...entry.record.shippingCost,value:{currency:editedCurrency,minor:0}}
        : entry.record.shippingCost;
    const shippingChanged = JSON.stringify(shippingCost) !== JSON.stringify(entry.record.shippingCost);
    nextCosts.push(cost);
    if (sameCost && !shippingChanged && JSON.stringify(nextCondition) === JSON.stringify(entry.record.condition)) continue;
    const nextCopy = cardCopySchema.parse({
      ...entry.record,cardCost:cost,condition:nextCondition,shippingCost,
      revision:entry.record.revision+1,updatedAt:updateAt,
    });
    if (shippingChanged) membershipChanged = true;
    audited(entry,{collection:'copies',record:nextCopy});
    if (!sameCost) {
      membershipChanged = true;
      const lineId = entry.record.acquisition.lineId;
      const originalLine = lines.find(l=>l.collection==='lines' && l.record.id===lineId);
      if (!originalLine || originalLine.collection!=='lines') throw Error('Imported purchase line unavailable');
      const nextLine = importedPurchaseLineSchema.parse({...originalLine.record,
        pricing:{mode:'per-copy',unitPrice:parsed ? {status:'known',value:parsed,source:'user'} :
          {status:'unknown',reason:'Price cleared by owner'}},
        revision:originalLine.record.revision+1,updatedAt:updateAt,
      });
      audited(originalLine,{collection:'lines',record:nextLine});
    }
  }
  let nextOrdinal = lines.reduce((max,l)=> l.collection==='lines' && 'ordinal' in l.record ? Math.max(max,l.record.ordinal) : max,-1)+1;
  const memberships = records.flatMap(e=>e.collection==='memberships' && e.record.transactionId===before.id ? [e.record] : []);
  const shipmentId = memberships[0]?.shipmentId;
  let nextMembershipOrdinal = memberships.reduce((max,m)=>Math.max(max,m.ordinal),-1)+1;
  const possession = copies.length && copies.every(c=>c.collection==='copies' && c.record.possession==='received')
    ? 'received' as const : 'pending' as const;
  for (const field of input.cards) {
    if (originalIds.has(field.id)) continue;
    if (records.some(e=>e.record.id===field.id)) throw Error('Duplicate card identity');
    idSchema.parse(field.id);
    const catalog = catalogRefSchema.parse(field.catalog);
    const currency = currencySchema.parse(field.currency);
    const price = field.amount.trim() ? parseMoney(field.amount.trim(),currency) : null;
    const condition = field.condition === 'unknown' ? {status:'unknown' as const,reason:'Not recorded'} :
      {status:'known' as const,value:conditionSchema.parse(field.condition),source:'user' as const};
    const metadata = {schemaVersion:1 as const,ownerUid:owner,revision:1,createdAt:updateAt,updatedAt:updateAt};
    const lineId = 'import-line-'+crypto.randomUUID();
    const unitPrice = price ? {status:'known' as const,value:price,source:'user' as const} :
      {status:'unknown' as const,reason:'No recorded card price'};
    creates.push({collection:'lines',record:importedPurchaseLineSchema.parse({
      ...metadata,id:lineId,origin:'legacy-import',transactionId:before.id,
      ordinal:nextOrdinal++,quantity:1,catalog,pricing:{mode:'per-copy',unitPrice},
    })});
    creates.push({collection:'copies',record:cardCopySchema.parse({
      ...metadata,id:field.id,catalog,condition,
      acquisition:{kind:'purchase',transactionId:before.id,lineId,unitOrdinal:0},
      acquiredOn:date ? {status:'known',value:date,source:'user'} : {status:'unknown',reason:'Purchase date not recorded'},
      possession,disposition:'held',dispositionRecordId:null,notes:'',
      cardCost:price ? {status:'exact',value:price,evidenceRef:before.id} : {status:'unknown',reason:'No recorded card price'},
      shippingCost:shippingAllocation?.get(field.id)
        ? {status:'exact',value:shippingAllocation.get(field.id)!,evidenceRef:before.id}
        : price ? {status:'exact',value:{currency,minor:0},evidenceRef:before.id}
        : {status:'unknown',reason:'No recorded additional shipping'},
      taxCost:{status:'unknown',reason:'Not separately recorded'},feeCost:{status:'unknown',reason:'Not separately recorded'},
    })});
    if (shipmentId) creates.push({collection:'memberships',record:shipmentMembershipSchema.parse({
      ...metadata,id:'import-member-'+crypto.randomUUID(),shipmentId,transactionId:before.id,
      copyId:field.id,ordinal:nextMembershipOrdinal++,
    })});
    nextCosts.push(price ? {status:'exact',value:price,evidenceRef:before.id} :
      {status:'unknown',reason:'No recorded card price'});
    membershipChanged = true;
  }
  if (input.transactionCurrency && (before.currency.status!=='known' || before.currency.value!==input.transactionCurrency))
    membershipChanged = true;
  if (enteredShipping && (before.shipping.status!=='known' ||
      before.shipping.value.minor!==enteredShipping.minor ||
      before.shipping.value.currency!==enteredShipping.currency))
    membershipChanged = true;
  if (input.trackingNumber!==undefined || input.carrier!==undefined) {
    const trackingNumber=input.trackingNumber?.trim()??'';
    const carrier=input.carrier?.trim()??'';
    const shipmentIds=[...new Set(memberships.map(m=>m.shipmentId))];
    if (shipmentIds.length>1 && (trackingNumber || carrier)) throw Error('Multiple linked shipments need individual edits');
    if (shipmentIds.length===1) {
      const shipment=records.find(e=>e.collection==='shipments' && e.record.id===shipmentIds[0]);
      if (shipment?.collection!=='shipments') throw Error('Linked shipment unavailable');
      const changed = (shipment.record.trackingNumber??'')!==trackingNumber || (shipment.record.carrier??'')!==carrier;
      if (changed) {
        const {tracking:oldTracking,...unchanged}=shipment.record;
        const trackingKept = (shipment.record.trackingNumber??'')===trackingNumber && oldTracking ? {tracking:oldTracking} : {};
        audited(shipment,{collection:'shipments',record:{...unchanged,...trackingKept,
          trackingNumber:trackingNumber||null,carrier:carrier||null,
          revision:shipment.record.revision+1,updatedAt:updateAt}});
      }
    } else if (shipmentIds.length===0 && (trackingNumber || carrier)) {
      const shipmentId='shipment-'+crypto.randomUUID();
      const metadata={schemaVersion:1 as const,ownerUid:owner,revision:1,createdAt:updateAt,updatedAt:updateAt};
      creates.push({collection:'shipments',record:{...metadata,id:shipmentId,
        carrier:carrier||null,trackingNumber:trackingNumber||null,
        deliveredOn:{status:'unknown',reason:'Not delivered'},notes:''}});
      const activeIds=input.cards.map(card=>card.id);
      for (const [ordinal,copyId] of activeIds.entries()) {
        creates.push({collection:'memberships',record:shipmentMembershipSchema.parse({
          ...metadata,id:'membership-'+crypto.randomUUID(),shipmentId,transactionId:before.id,copyId,ordinal,
        })});
      }
    }
  }
  const source = input.source && (before.source || input.source.kind!=='other' || input.source.seller || input.source.listingUrl || input.source.itemReference)
    ? input.source : before.source;
  const sourceChanged = JSON.stringify(source) !== JSON.stringify(before.source);
  const oldDate = before.transactionOn.status === 'known' ? before.transactionOn.value : '';
  const nextDate = date === oldDate ? before.transactionOn : date
    ? {status:'known' as const,value:date,source:'user' as const} :
      {status:'unknown' as const,reason:'Purchase date cleared by owner'};
  if (!updates.length && !creates.length && nextDate === before.transactionOn && input.notes === before.notes &&
      !sourceChanged && !membershipChanged) return null;
  const totals = new Map<Currency,bigint>();
  let unpriced = 0;
  for (const cost of nextCosts) {
    if (cost.status !== 'exact') {unpriced++;continue;}
    totals.set(cost.value.currency,(totals.get(cost.value.currency)??0n)+BigInt(cost.value.minor));
  }
  const nativeCardTotals = [...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,minor])=>{
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Cost overflow');
    return {currency,minor:Number(minor)};
  });
  const single = nativeCardTotals.length===1 ? nativeCardTotals[0] : null;
  const nextSubtotal = single && unpriced===0 ? {status:'known' as const,value:single,source:'user' as const} :
    {status:'unknown' as const,reason:'Mixed currencies or incomplete card prices'};
  const nextCurrency = single ? {status:'known' as const,value:single.currency,source:'user' as const} :
    {status:'unknown' as const,reason:'No single purchase currency'};
  const adjustedEvidence = (field: ImportedPurchase['shipping']) => {
    if (!single || field.status==='unknown' || field.value.currency===single.currency) return field;
    if (field.value.minor!==0) throw Error('Cannot silently convert historical expenses');
    return {status:'known' as const,value:{currency:single.currency,minor:0},source:'user' as const};
  };
  const previousShipping = adjustedEvidence(before.shipping);
  const shipping = enteredShipping && single
    ? {status:'known' as const,value:enteredShipping,source:'user' as const}
    : previousShipping;
  const confirmedShipping = before.totalBasis==='owner-confirmed-total' ||
    (enteredShipping!==null && enteredShipping.minor>0);
  if (confirmedShipping && (nextSubtotal.status!=='known' || shipping.status!=='known'))
    throw Error('Confirmed purchase total requires all card prices and shipping');
  const extras = [adjustedEvidence(before.taxes),adjustedEvidence(before.fees)]
    .reduce((sum,value)=>sum+(value.status==='known'?BigInt(value.value.minor):0n),0n);
  const nextPayable = confirmedShipping && nextSubtotal.status==='known' && shipping.status==='known'
    ? {status:'known' as const,value:{
        currency:nextSubtotal.value.currency,
        minor:safeInteger(BigInt(nextSubtotal.value.minor)+BigInt(shipping.value.minor)+extras),
      },source:'user' as const}
    : nextSubtotal;
  const originalFields={...before};
  delete originalFields.shippingIncludedInCardPrices;
  const transaction: ImportedPurchase = importedPurchaseSchema.parse({
    ...(confirmedShipping ? originalFields : before),
    transactionOn:nextDate,notes:input.notes,
    ...(sourceChanged ? {source} : {}),
    ...(membershipChanged ? {
      totalBasis:confirmedShipping ? 'owner-confirmed-total' : 'recorded-card-prices',
      currency:nextCurrency,subtotal:nextSubtotal,payable:nextPayable,
      nativeCardTotals,unpricedCopyCount:unpriced,
      shipping, taxes:adjustedEvidence(before.taxes),fees:adjustedEvidence(before.fees),
    } : {}),
    revision:before.revision+1,updatedAt:updateAt,
  });
  audited(purchase,{collection:'transactions',record:transaction});
  // Firestore security rules cap distinct audit lookups, not record writes.
  // A single immutable grouped revision keeps 20+ price/shipping corrections atomic.
  if (updates.length>20) {
    const revisions=creates.filter(entry=>entry.collection==='revisions');
    const first=revisions[0];
    if (!first || first.collection!=='revisions' || revisions.length!==updates.length)
      throw Error('Audited corrections must match all changed records');
    const additional: Record<string,{before: typeof first.record.before;after:typeof first.record.after}> = {};
    for (const entry of revisions.slice(1)) {
      if (entry.collection!=='revisions' || entry.record.recordId in additional ||
          entry.record.recordId===first.record.recordId) throw Error('Ambiguous grouped audit identity');
      additional[entry.record.recordId]={before:entry.record.before,after:entry.record.after};
    }
    creates.splice(0,creates.length,
      ...creates.filter(entry=>entry.collection!=='revisions'),
      {collection:'revisions',record:revisionSchema.parse({...first.record,additional})});
  }
  const command:PortfolioCommit = {ownerUid:owner,idempotencyKey:'edit-'+crypto.randomUUID(),creates,updates};
  prepareCommit(owner,command,450);
  validateImportedPurchaseEdit(command);
  return command;
}
