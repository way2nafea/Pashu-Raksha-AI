# SIH 2026 Demo Script (5–10 minutes)

**Setup beforehand:** backend running (auto-seeds demo data on startup),
web app running, both tabs open. Use the seeded dataset — it's designed so
the outbreak story is already visible, and you'll add one more live case
during the demo.

## 1. The story so far (30 seconds)

Open **Government Dashboard** (`admin@pashuraksha.demo`). Point out: 9
farms, 27 animals, an active outbreak already flagged in Thane district
from earlier reports, risk distribution chart. This is the state before
today's new case.

## 2. Farmer reports a new case (90 seconds)

Sign out, sign in as `farmer@pashuraksha.demo`. Go to **Report Symptoms**.
Walk through the guided flow:
- Select farm + animal
- Symptoms: Fever, Skin lesions, Reduced appetite
- Severity: Severe, Duration: 3 days, Affected: 2, Mortality: 1,
  Unvaccinated
- Use current location (or accept demo coordinates near Bhayandar)
- Submit

**Show the instant result screen**: risk score, CRITICAL badge, suspected
disease category, recommended action, and — because this lands inside the
seeded Village A/B cluster — the "Potential Outbreak Cluster Detected"
panel. This is the moment that sells the demo: one form submission
triggers AI triage, nearby-case detection, and outbreak escalation, all
inline.

## 3. Veterinarian responds (2 minutes)

Sign in as `vet@pashuraksha.demo`. Show the **Case Queue**, sorted
CRITICAL-first — the new case is at the top. Open it:
- Point out the outbreak-cluster banner
- Assign to self
- **Field Visit** tab: record observations
- **Lab Request** tab: request a PCR test
- Show the case detail's Animal History / Farmer / Farm context panels

## 4. Lab processes the sample (1 minute)

Sign in as `lab@pashuraksha.demo`. Open **Sample Queue**, advance the new
sample through COLLECTED → SENT → RECEIVED → TESTING, then enter a result.

## 5. Vet closes the loop (1 minute)

Back as the vet, open the case again — the lab result is now visible.
Go to the **Treatment** tab, record diagnosis + medication, check "Mark
case as resolved."

## 6. Government sees it all (1 minute)

Sign in as `admin@pashuraksha.demo` (or `district@pashuraksha.demo`).
Refresh the **Overview** — resolved-case count ticked up, mortality total
updated. Open **GIS Risk Map** — show the colored risk markers, the
dashed outbreak-cluster circle over Thane, and filter by risk level.

## 7. Close (30 seconds)

"One report, one connected system: AI triage in under a second, automatic
outbreak detection from a real geographic cluster, a full veterinary and
laboratory workflow, and a live government command center — all backed by
role-based access control and a full audit trail."
