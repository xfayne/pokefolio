import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { selectPurchaseDetails } from '@/domain/purchase-details';
import { PurchaseDetails } from './purchase-details';
import { sampleHistory, samplePurchaseShipments } from './sample';
import { importedPurchaseSchema } from '@/domain/schema';

afterEach(async () => { vi.unstubAllGlobals(); await i18n.changeLanguage('en'); });
it('renders the approved purchase breakdown and opens the exact physical copy', async () => {
  const view = selectPurchaseDetails(sampleHistory, 'sample-nov-19', samplePurchaseShipments)!;
  const inspect = vi.fn();
  render(<PurchaseDetails view={view} onInspect={inspect} />);
  expect(screen.getByRole('heading', { name: 'eBay · cardcorner' })).toBeInTheDocument();
  const breakdown = screen.getByRole('region', { name: 'Cost breakdown' });
  expect(within(breakdown).getByText('$130.00')).toBeInTheDocument();
  expect(within(breakdown).getByText('$12.00')).toBeInTheDocument();
  expect(within(breakdown).getByText('$142.00')).toBeInTheDocument();
  expect(screen.queryByText('Shipping: $4.00 per copy')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /^Gengar/ }));
  expect(inspect).toHaveBeenCalledWith(view.copies[1]?.copy);
});
it('copies the full tracking number and offers selectable text on clipboard failure', async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockRejectedValueOnce(new Error('Denied')).mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  render(<PurchaseDetails view={selectPurchaseDetails(sampleHistory, 'sample-nov-19', samplePurchaseShipments)!} onInspect={vi.fn()} />);
  const button = screen.getByRole('button', { name: /^Copy tracking number/ });
  await user.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy');
  expect(screen.getByText('DEMO-RM00004821GB', { exact: true })).toBeInTheDocument();
  await user.click(button);
  expect(writeText).toHaveBeenLastCalledWith('DEMO-RM00004821GB');
  expect(await screen.findByRole('status')).toHaveTextContent('Tracking number copied');
});
it('keeps no-shipment purchases honest and translates screen labels for RTL', async () => {
  await i18n.changeLanguage('he');
  render(<PurchaseDetails view={selectPurchaseDetails(sampleHistory, 'sample-nov-16', [])!} onInspect={vi.fn()} />);
  expect(screen.getByText('לא קושר משלוח')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'פירוט עלויות' })).toBeInTheDocument();
  expect(document.documentElement.dir).toBe('rtl');
});

it('shows tracking failure as plain text inside its shipment without changing the purchase status', () => {
  const view = selectPurchaseDetails(sampleHistory, 'sample-nov-19', samplePurchaseShipments)!;
  render(<PurchaseDetails view={view} onInspect={vi.fn()} trackingErrors={{'DEMO-RM00004821GB':'Provider failed'}} />);
  const shipment = screen.getByRole('region', {name:'Shipment'});
  expect(within(shipment).getByText('Tracking error')).toBeInTheDocument();
  expect(within(shipment).queryByText('In transit')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('displays mixed legacy prices in native currencies without a fictional total or extra shipping', () => {
  const unknown={status:'unknown',reason:'Mixed or unrecorded'} as const;
  const purchase=importedPurchaseSchema.parse({
    schemaVersion:1,ownerUid:sampleHistory.ownerUid,id:'legacy-native',revision:1,
    createdAt:'2026-11-23T10:00:00Z',updatedAt:'2026-11-23T10:00:00Z',
    kind:'purchase',origin:'legacy-import',sourceParcelId:'parcel',notes:'',
    transactionOn:{status:'known',value:'2026-11-16',source:'legacy'},currency:unknown,
    subtotal:unknown,payable:unknown,shipping:unknown,taxes:unknown,fees:unknown,
    totalBasis:'recorded-card-prices',settlement:'unknown',shippingIncludedInCardPrices:true,
    nativeCardTotals:[{currency:'GBP',minor:10000},{currency:'USD',minor:1400}],unpricedCopyCount:3,
  });
  const data={...sampleHistory,transactions:[purchase],copies:[],saleLines:[],inTransit:[]};
  const view=selectPurchaseDetails(data,purchase.id,[])!;
  render(<PurchaseDetails view={view} onInspect={vi.fn()} />);
  const breakdown=screen.getByRole('region',{name:'Cost breakdown'});
  expect(within(breakdown).getAllByText('£100.00 + $14.00')).toHaveLength(2);
  expect(within(breakdown).getByText('Known card costs')).toBeInTheDocument();
  expect(within(breakdown).getByText('0')).toBeInTheDocument();
  expect(within(breakdown).getByText('3 cards have no recorded prices')).toBeInTheDocument();
});
