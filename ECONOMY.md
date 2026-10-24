# V2 economy audit and calibration

V1 used a $2,400 opening budget. The audit's eight-worker / one-IT / one-janitor layout required $4,100 before its floor/elevator costs; eight workers with two of each specialist required $4,480. The opening budget could not comfortably fund the intended team. V1's displayed "net" also combined construction spending with operating results and mixed objective rewards into revenue. That made investment losses look like recurring operating losses.

The audit did not reproduce multiplied wages or missing button credits: V1 eight-worker layouts generated approximately $354–380 daily operating surplus after setup, or $292–318 with two of each specialist. Commute time, the short 100-second work window in a 240-second day, breaks and accumulated faults/waste reduced actual productive time. V1 repairs and cleaning could duplicate jobs and choose the wrong workstation; cleaning had no direct connection to output. V2 uses fixed workstation coordinates and exclusive, persistent tasks instead.

## Editable V2 figures (`src/config.ts`)

- Starting cash: **$30,000**, only for new companies. No migration cash grant.
- Base contact revenue: **$12**. Nominal cycle: **2.8 simulated seconds**, modified by happiness, promotions and supervision. Revenue and paper occur at phase **0.65**, the contact frame.
- Daily salaries: worker **$60**, IT **$90**, janitor **$65**, researcher $80, supervisor $100, accountant $90, HR $80. Salaries accrue once per simulated second throughout the 240-second day.
- Studio $3,500; workshop $2,500; lab $5,000; restroom $1,200; common room $1,800; management $4,000. Worker hire $450; IT $700; janitor $500.
- Floors: $2,500 + $750 × existing floor count; lift extension $1,200. Upgrades cost $1,800 × current tier and add 45% of base contact value per tier. Promotions cost $700 × level, add 25% cycle productivity and 45% base salary per level.
- One paper unit per two contacts; bin capacity 60. Bins visibly overflow up to 120 tracked units. Overflow has a capped morale penalty. A cleaning task takes 8 seconds after arrival. IT repair takes 10 seconds. Training and promotions reduce specialist job times.
- Fault chance: 0.3% per successful contact, halved by reliability research. Faults never earn revenue until repaired. No recurring building fee is charged; the finance panel shows other operating expenses as $0 rather than inventing costs.

## Deterministic 20-day results

These are simulation results, not promises about every player's layout. Seed 7321, fixed 0.05-second steps. Rewards and construction are excluded from operating profit. The 16-worker case hires its final four staff after earning a day's revenue; it receives no extra cash.

| Workers / IT / janitors | Mean operating profit per full day | Ending cash |
| ----------------------- | ---------------------------------: | ----------: |
| 4 / 0 / 0               |                               $579 |     $37,359 |
| 8 / 1 / 1               |                             $2,147 |     $59,515 |
| 8 / 2 / 2               |                             $1,992 |     $55,215 |
| 16 / 2 / 2              |                             $4,032 |     $80,253 |

The unsupported four-worker company accumulates unrepaired faults, so it should eventually hire specialists. The five-floor expansion test earns research points, unlocks height, purchases floors and elevator extensions, and ends day 21 with $31,065. A four-technician company without productive workers loses money as intended. Eight-worker results are exactly identical when the same simulation steps are batched at 1×, 2×, 4×, 8× and 16× over twenty days.

Nineteen automated tests cover the economy, exclusive jobs, specific workstation repairs, night cleaning, no phantom contacts, five-floor transport and 24 productive workers, save/task restoration and V1 migration. Browser acceptance additionally establishes the team through UI controls, advances more than five days, checks profitability and persistence, and checks the rendered hand at the shared button-contact pixel. Real iOS Safari remains untested.
