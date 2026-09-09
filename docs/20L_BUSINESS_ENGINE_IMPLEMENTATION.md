# Aquora 20L business-engine implementation

## Audit result

The legacy 20L implementation is contained in `OperationsController`, the `Operations*` entities, Customer’s 20L fields, `InventoryMovementService`, and the operator jar dashboard. It records loading, unloading, filling, washing, quarantining and reservations. Customers double as distributors. `OutstandingJars` and `ReservedEmptyJars` are mutable counters, and the existing `InventoryMovement` table has no owner, holder, physical location, or container-state dimension. Sales pricing is supplied by the client, while a customer has a single distributor type and commission percentage.

No existing 20L route, vehicle, delivery, ownership ledger, rate-history, or compensation-rule entity exists. The existing Operations endpoints remain untouched for backwards compatibility.

## Introduced foundation

The new `/api/v1/20l` boundary adds four 20L-only tables:

| Table | Purpose |
| --- | --- |
| `TwentyLDistributorProfiles` | Configurable distributor commercial and asset-ownership profile, attached to the existing Customer master. |
| `TwentyLJarMovements` | Append-only container ledger: owner, source holder/location, destination holder/location, status, quantity, source reference, actor and timestamp. |
| `TwentyLRateRules` | Effective-dated rates by product, party, refill type, jar owner type and minimum quantity. |
| `TwentyLDeliveries` | Delivery execution snapshot, distinct from a sale, including delivered/empty/failed quantities, route/vehicle/driver references and frozen commercial terms. |

`POST /api/v1/20l/deliveries` resolves an effective rate (or records an explicit authorized override), snapshots it on the delivery, and creates the filled-delivery and empty-collection ledger movements in one database transaction. Old invoices/rates cannot change when a rule is edited later. `POST /api/v1/20l/jar-movements` rejects a movement from a non-plant source that lacks a ledger-derived balance.

## Migration and rollout

1. Apply the EF migration created from this model before enabling the new API.
2. Create a distributor profile only for customers operating as distributors; ordinary customers need no duplicate master record.
3. Reconcile each legacy `OutstandingJars` balance and load a single, explicitly labelled `OPENING_BALANCE` movement. It must be reviewed by the business owner because legacy records do not identify the owner of those jars.
4. Configure rate rules with effective dates before recording new deliveries. Do not derive historical prices from the current price list.
5. Move new 20L workflows to the new endpoint; keep legacy Operations records read-only for historical reporting during the transition.

## Deliberately deferred business choices

No default liability, deposit, commission formula, or distributor type has been invented. Those must be configured as tenant business rules before implementing deposits, damages/loss charges, commission postings, and settlement journals. Routes/vehicles remain references in delivery records until the existing fleet/employee model is selected or a dedicated 20L assignment history is approved.

## Verification matrix

- Company-owned jars issued to, and returned by, a distributor.
- Distributor-owned empty jars received at the plant, refilled, and returned while retaining distributor ownership.
- Customer-owned refill with no company inventory impact.
- Partial delivery: ordered quantity exceeds delivered quantity and failure reason is retained.
- Customer-specific future rate: old delivery keeps its original `AppliedUnitRate`; new delivery uses the later rule.
- Attempted movement exceeding a distributor/customer’s ledger-held balance is rejected.

## Continuation audit and gap matrix

| Requirement | Before continuation | Result |
| --- | --- | --- |
| Ownership, holder and location | Owner plus overloaded location/customer fields | Holder is now explicitly recorded independently from physical location. |
| Plant dispatch integrity | Plant was exempt from balance validation | All non-opening/purchase movements validate ledger-held source quantity. |
| Rate determinism | Rate lookup was specific-party then quantity/date | Active overlapping rules of equal scope/priority are rejected; resolution is party specificity, priority, threshold, then date. |
| Price override | Client could supply a manual rate | Requires `20L.OverridePrice`; matching authorization-required rules cannot silently apply. |
| Partial delivery | Failed quantity was stored but unconstrained | Failed quantity now requires a reason. |
| Commission/margin | Profile had only a model label | Effective-dated commission rules and frozen delivery-linked transactions are available. |
| Operational reporting | No dedicated endpoint | A backend-derived 20L daily dashboard is available. |
| Fleet/routes, payments, settlements, equipment | No safe reusable fleet model; delivery had string references | Intentionally not fabricated. These need an approved 20L-specific lifecycle and financial integration design. |
