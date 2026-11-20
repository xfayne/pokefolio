# Physical-copy inventory (#7)

`frontend/src/domain/inventory.ts` selects held copies by catalog ID without collapsing physical IDs. Received holdings alone contribute to portfolio value; pending and unknown possession remain visible separately. Sold/returned/gifted/lost records are excluded from current holdings. Missing catalog entries remain visible, and unavailable prices are not zero. Market quotes must match grade, edition, language, finish and currency; conflicting latest quotes are unavailable. No current FX is substituted for historical cost evidence.

Metadata edits can change only one held copy's condition, edition and notes. They produce an immutable audit and increment its optimistic revision. Cost/acquisition/lifecycle changes belong to transaction workflows (#8/#9). No-op edits create no revision. A future adapter must atomically commit the copy and audit with expected-revision checks; these pure commands perform no writes.

Binder references name one exact physical copy. Receipt, metadata edits and sale never substitute another copy or compact pockets. Explicit empty and Wishlist pockets, indexes and nine-slot page boundaries stay intact. Missing or disposed references remain reserved for explicit handling by #13; do not automatically reassign a sibling or alter Wishlist order/matching.

The approved Collection Cards and Card Details mocks are reused. Live owner-scoped persistence remains the dedicated #8/#21 adapter work; no legacy production reads or writes are introduced here.
