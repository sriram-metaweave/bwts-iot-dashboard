# Alfa Laval PureBallast 3.1 — Maintenance Schedule

**Source:** Alfa Laval PureBallast 3.1 System Manual, Book No. 9028188 02, Rev. 0 (2016)  
**System:** UV-based Ballast Water Treatment System (BWTS) with 16 UV lamps

---

## Quick Reference — Schedule by Frequency

### Monthly

| Task | Component |
|------|-----------|
| Testrun system — run ballast/deballast process followed by CIP cycle | Full system |
| Manually operate any unused valves (e.g. V212-31) to prevent seizure | Valves |

### Every 3 Months

| Task | Component | Action Trigger |
|------|-----------|----------------|
| Check CIP liquid pH | CIP module | Replace immediately if pH > 3 (target: 2.0–3.0) |
| Check CIP liquid level | CIP module | Refill as needed; do not exceed 250 L tank max |

### Annual

| Task | Component | Notes |
|------|-----------|-------|
| Inspect system for corrosion and erosion damage | Full system | Visual inspection |
| Inspect UV reactor outer seals for leakage | UV reactor | Replace faulty seals; service kit available |
| Check UV lamps for leakage | UV reactor | See quartz sleeve disassembly procedure |
| Inspect and clean filter element | Filter | More frequent cleaning required in muddy-water ports |
| Inspect filter outer seals for leakage | Filter | Replace faulty seals |
| Replace CIP liquid | CIP module | Also replace when pH > 3 or after 1+ year of inactivity |
| Check all cable and hose connections | Electrical / Valves | CIP valve block, actuators, power cables |
| Calibrate sensors | Controls | Per calibration schedule (see below) |

### Every 2 Years

| Task | Component | Notes |
|------|-----------|-------|
| Replace UV sensor (QT201-50) | UV sensor | IMO requirement; EPA requires annual replacement |
| Calibrate flow meter | Flow meter | Compare with calibrated portable ultrasonic meter under flow conditions |

### Usage-Based / Condition-Based

| Task | Trigger | Component |
|------|---------|-----------|
| **Replace all 16 UV lamps** | After **3,000 hours** of operation | UV reactor |
| Replace quartz sleeve | When broken, or during UV lamp replacement | UV reactor |
| Replace CIP liquid | When pH > 3 | CIP module |
| Replace PLC battery | After **5 years** OR on "PLC battery low" alarm | Control system |
| Inspect stored CIP liquid for degradation | After 3 years in storage | CIP module |

---

## Calibration Schedule

| Instrument | Procedure | Frequency |
|------------|-----------|-----------|
| Flow meter | Compare with calibrated portable ultrasonic flow meter | Every 2 years |
| Filter pressure transmitters (PT201-71, PT201-72) | Connect calibrated equipment to measure point | Every 1–2 years |
| Pressure transmitter PT201-16 | Connect calibrated equipment, compare readings | Every 1–2 years |
| Pressure gauge PI201-18 | Compare with calibrated equipment | Every 1–2 years |
| Pressure service valve PT201-15 | Test valve functionality | Every 1–2 years |
| UV sensor QT201-50 | **Not calibrated** — replace per maintenance schedule | Per replacement schedule |
| UV temperature transmitter TT201-33 | Place in water of known temperature, compare | Every 1–2 years |
| UV temperature switch TS201-60 | Place in water < 65°C, check for alarm signal | Every 1–2 years |
| UV level switch LS201-29 | Immerse in water, verify signal | Every 1–2 years |
| LDC temperature transmitter TT401 | Compare with calibrated thermometer after 30 min | Every 1–2 years |

---

## Detailed Maintenance Procedures

### UV Lamp Replacement

**Trigger:** 3,000 hours of operation  
**Spare part:** UV lamp set `9009521 80` (1 lamp + 2 O-rings per set; 16 sets required)  
**Manual reference:** Part 2, Chapter 4, Pages 133–140

**Safety before starting:**
- Disconnect power supply
- Lock valves V201-9, V201-3, and V201-8
- Wait 10 minutes for reactor to cool — internal pressure hazard if hot
- Wear protective gloves; handle lamps only by ceramic ends
- Wear eye protection
- Note: each lamp contains < 0.2 g mercury — dispose per local regulations

**Procedure:**
1. Unscrew cap nuts holding the caps (one each side per lamp)
2. Disconnect both cable connectors at each end
3. Draw out lamp bushes on both sides
4. Pull out UV lamp by cables; hold by ceramic ends only
5. Place used lamp immediately in protective cover
6. Inspect quartz sleeve for breaks — if broken, follow quartz sleeve procedure below
7. Mount new heat-resistant O-rings in both lamp bushes
8. Place bush on new UV lamp and insert into reactor
9. Insert opposite bush
10. Clean connectors (no rust or burning)
11. Reconnect cable connectors; mount UV lamp caps; tighten cap nut by hand only
12. Ensure cables are not squeezed between cap and bush
13. Re-fit drain plugs at reactor bottom and flanges
14. **Reset lamp runtime counter in control system**

---

### Quartz Sleeve Replacement

**Trigger:** When broken, or at time of UV lamp replacement  
**Spare part:** Quartz sleeve set `594645 82` (1 quartz sleeve + 2 O-rings)  
**Manual reference:** Part 2, Chapter 4, Pages 138–140

**Disassembly:**
1. Close inlet (V201-19.n) and outlet (V201-20.n) valves from control system
2. Depressurize and drain reactor (remove drain plug)
3. Disconnect instrument air
4. Disassemble UV lamp (see above)
5. Loosen three Allen screws on glass socket — a few turns only
6. Unscrew completely at one side; carefully remove glass socket
7. Remove the second glass socket
8. Remove O-rings (firmly stuck — use O-ring tool; moisten with acetone/denatured alcohol if needed)
9. Carefully remove quartz sleeve — avoid breaking glass

**Assembly:**
1. Insert quartz sleeve into reactor
2. Wet new O-rings and slip over both sides of quartz sleeve
3. Mount first glass socket with three Allen screws evenly — do not tighten yet
4. Evenly tighten screws to **7 Nm** torque
5. Mount second glass socket
6. Connect instrument air
7. Pressurize reactor with water to 2–4 bar
8. Visually inspect for leaks
9. Proceed with UV lamp assembly

---

### Filter Element Inspection and Cleaning

**Trigger:** Once a year (more frequent in muddy-water conditions)  
**Spare part:** Filter spare parts kit `9011963 84`  
**Manual reference:** Part 2, Chapter 5, Pages 145–152

**Safety before starting:**
- Disconnect power using main switch on control cabinet
- Lock valves V201-9, V201-3, V201-8
- Work only when filter is cooled, depressurized, and drained
- Shut off air supply to filter
- Use lifting device — filter cover + element weight: **220 kg**

**Cleaning procedure:**
1. Remove filter element
2. Rinse pre-filter with water and brush
3. Remove filter element gasket
4. Soak element in cleaning agent (1 part Alpacon descalant to 20 parts fresh water), opening facing up, for **1–4 hours**
5. Let element drip dry
6. Spray element with warm water (60–80°C) using flat nozzle
   - High-pressure cleaner: max 15 bar, min 30 cm distance
7. Blow element with instrument air (10 micron filter or finer) from outside inward
8. Inspect element from outside with magnifier — must be visibly clean
9. If still dirty, repeat with a 5-minute soak
10. Clean inside of filter housing
11. Replace filter element gasket
12. Reassemble filter

**Cleaning agent:** Alpacon descalant offshore — mix at 1:20 concentrate to fresh water; pH 2.0–3.0; causes eye/skin irritation — use PPE.

---

### CIP Liquid Maintenance

**Manual reference:** Part 2, Chapter 6, Pages 153–155

**Specifications:**
- Tank capacity: 250 litres maximum
- Storage temperature: 0°C to +55°C
- Product: Alpacon descalant offshore (non-flammable, no solvents, no inorganic acids)
- Disposal: drain tank or waste/sludge tank — **NOT bilge** — per local regulations

**pH and Level Checks (every 3 months):**
- Target pH: 2.0–3.0
- Replace immediately if pH > 3

**CIP Liquid Change Procedure:**
1. Drain tank via manual drain valve V460-3 (or via pump/valve procedure with Advanced operator login)
2. Fill tank with ~240 litres fresh water
3. Pour in CIP liquid concentrate
4. Measure pH — should be ~2.0; adjust if needed
5. Reset "Total number CIP:ed reactors" counter in control system

**CIP Liquid Refill Procedure:**
1. Measure current pH
2. Mix concentrate with fresh water separately (1:20 ratio)
3. Add to tank — do not exceed Max fill line
4. Re-measure pH; if still > 3, replace entire liquid

**Spare part:** CIP liquid — recommend minimum 2 cans onboard (`596250 01`)

---

### Valve Locking / Isolation

**Manual reference:** Part 2, Chapter 3, Pages 129–131

**Critical safety valves to lock before any system opening:**  
V201-3, V201-9, V201-8

**Lock valve in closed position:**
1. Set valve to closed from control system; confirm position indicator
2. Disconnect power and instrument air
3. Open padlock; remove safety cover
4. Note exact end stop bolt distance from reference surface
5. Open locking bolt slightly; screw end stop bolt to bottom; tighten locking bolt
6. Verify valve cannot open
7. Replace safety cover; lock with padlock

**Unlock procedure:**
1. Disconnect power and instrument air
2. Open padlock; remove safety cover
3. Loosen locking bolt; reset end stop bolt to original noted distance
4. Tighten locking bolt; verify valve opens and closes freely

---

## Recommended Onboard Spare Parts

| Component | Part Number | Contents |
|-----------|-------------|---------|
| UV lamp set | 9009521 80 | 1 UV lamp + 2 O-rings |
| Quartz sleeve set | 594645 82 | 1 quartz sleeve + 2 O-rings |
| UV temperature transmitter | 9006325 02 | — |
| UV temperature switch | 9006324 02 | — |
| Lamp power supply (LPS) | 9012146 01 | For Lamp Drive Cabinet |
| CIP module spare parts set | 9004587 80 | Diaphragm, muffler, ball, O-rings |
| Filter spare parts set | 9011963 84 | — |
| CIP liquid (minimum 2 cans) | 596250 01 | — |

---

## Safety Reminders

Before any maintenance on the PureBallast system:

1. Switch off power and disconnect from supply
2. Lock valves V201-3, V201-9, V201-8 in closed position
3. Allow UV reactor to cool for at least **10 minutes** — pressure hazard
4. Never work under pressure or with hot components
5. Wear gloves and eye protection
6. Handle UV lamps by ceramic ends only — fragile; contain mercury
7. Dispose of used lamps and CIP liquid per local and flag-state regulations
8. Record all maintenance in the vessel's maintenance log (IMO/BWMC requirement)

---

## Regulatory Requirements

| Requirement | Standard | Interval |
|-------------|----------|---------|
| UV sensor (QT201-50) replacement | IMO | Every 2 years |
| UV sensor (QT201-50) replacement | US EPA (USCG) | Every 1 year |
| Record maintenance in vessel log | IMO/BWMC | Every maintenance event |
| Login level for calibration / manual valve ops | Advanced operator or higher | — |
