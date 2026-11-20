# Imported purchase evidence — proposed domain extension (#6)

Status: Awaiting owner approval. Motivated by the owner's requirement that old
shipments become purchase transactions, rather than only opening inventory.

## Observed gap

The finalized purchase schema requires a valid transaction date and known payable
amount. Legacy parcels may contain a purchase date and card prices but no shipping
or actual paid total. Creating a finalized purchase would require inventing amounts.
Current offline previews retain these as purchase reconstruction drafts, with copy
links and known evidence. This is an intermediate representation, not the intended
final user experience.

## Proposed behavior

Add a distinct imported-purchase variant in the transaction domain, using explicit
known/unknown evidence for date, card subtotal, shipping, fees, taxes and paid total.
It is a historical purchase transaction with incomplete evidence, not a new manual
purchase awaiting checkout. It remains visible in transaction history with its
original purchase date when known; unknown dates are not assigned to import day.

Each unambiguous legacy shipment seeds one imported purchase and its card lines.
Preserve parcel metadata as a separate linked shipment. Conflicting membership or
several parcels that might represent one purchase remain blocking review items.
Do not infer a new copy because the same catalog ID appears in several parcels.

Copy acquisition links to the reconstructed imported purchase instead of retaining
an opening acquisition for the same evidenced purchase. Cards with no purchase
evidence remain opening inventory. Delivery changes existing copies only.

Do not create payment cash movements without actual payment amount/date evidence.
Known native card costs remain known; unknown shipping keeps complete basis
unavailable. Reports must expose coverage instead of pretending total spend or
profit is complete. A purchase date is not automatically a payment date.

Ordinary new manual purchase confirmation keeps the existing strict requirements.
Imported incomplete records can later be enriched through audited corrections,
without generating a new purchase or duplicate cash movement.

## Synthetic preview

Legacy parcel P: purchaseDate 2026-11-12, two cards priced GBP 20 and GBP 30,
no recorded shipping or total.

Proposed result: one imported purchase dated 2026-11-12; two lines and two physical
copies; known card subtotal GBP 50; shipping and payable total unknown; one linked
shipment preserving its original metadata; no invented cash movement.
This is not a claim that GBP 50 was the complete amount paid.

A childhood card without a parcel/price/date remains opening inventory with
unknown acquisition history and no transaction.

## Approval boundary

Approval authorizes this explicit domain extension, its offline mapping and tests.
It does not authorize real-data reads/writes, production migration or screen redesign.
