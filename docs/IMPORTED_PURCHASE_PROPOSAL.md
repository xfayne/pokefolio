# Legacy shipment purchase conversion (#6)

Status: Owner clarified and authorized implementation on 2026-11-20.

Each unambiguous legacy parcel becomes one imported purchase with linked per-copy
lines and shipment memberships. Recorded prices GBP 20 and GBP 30 produce a
transaction total GBP 50, retaining both individual prices. No separate shipping
amount is added when none was recorded. Charge coverage remains explicit; the
imported total basis is recorded-card-prices. This is a historical transaction,
not a draft awaiting manual checkout.

Missing dates/prices stay unknown. Mixed currencies or ambiguous membership block
automatic conversion. Ordinary new manual purchase confirmation stays strict.
Parcel-linked copies use purchase acquisition links, not duplicate opening inventory.
Cards without purchase evidence remain opening inventory. Delivery changes the same
copy. No payment cash movement is inferred solely from a parcel purchase date.
Exact Binder/Wishlist order and raw parcel metadata remain preserved.

Schemas: importedPurchaseSchema/importedPurchaseLineSchema. Materialization:
materializeLegacyImport. These records and commit
contracts grant no database permissions. Real-data apply still needs verified backup,
exact preview approval and a tested authenticated destination adapter.
