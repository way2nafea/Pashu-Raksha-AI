"use client";
import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import RiskBadge from "@/components/RiskBadge";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

export default function FarmsPage() {
  const { user, loading } = useRequireRole(["FARMER", "FIELD_WORKER"]);
  const [farms, setFarms] = useState<any[]>([]);
  const [animals, setAnimals] = useState<Record<string, any[]>>({});
  const [herdSummaries, setHerdSummaries] = useState<Record<string, any>>({});
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [showAnimalForm, setShowAnimalForm] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const f = await api.get("/api/v1/farms");
      setFarms(f);
      const animalMap: Record<string, any[]> = {};
      const herdMap: Record<string, any> = {};
      await Promise.all(f.map(async (farm: any) => {
        animalMap[farm.id] = await api.get(`/api/v1/animals?farm_id=${farm.id}`);
        try {
          herdMap[farm.id] = await api.get(`/api/v1/farms/${farm.id}/herd-summary`);
        } catch {
          herdMap[farm.id] = null;
        }
      }));
      setAnimals(animalMap);
      setHerdSummaries(herdMap);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your farms — check your connection.");
    }
  }

  useEffect(() => { if (user) refresh(); }, [user]);

  async function createFarm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/farms", {
        farm_name: fd.get("farm_name"), village: fd.get("village"), block: fd.get("block"),
        district: fd.get("district"), latitude: Number(fd.get("latitude")), longitude: Number(fd.get("longitude")),
        livestock_count: Number(fd.get("livestock_count") || 0),
      });
      setShowFarmForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create farm");
    }
  }

  async function createAnimal(e: React.FormEvent<HTMLFormElement>, farmId: string) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/animals", {
        farm_id: farmId, tag_id: fd.get("tag_id"), species: fd.get("species"),
        breed: fd.get("breed"), age_months: Number(fd.get("age_months") || 0), sex: fd.get("sex"),
      });
      setShowAnimalForm(null);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register animal");
    }
  }

  if (loading || !user) return null;

  return (
    <PortalShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>My Farms</h1>
        <button onClick={() => setShowFarmForm(!showFarmForm)} className="rounded-lg px-4 py-2 text-white font-semibold text-sm" style={{ background: "var(--brand)" }}>
          {showFarmForm ? "Cancel" : "+ Add Farm"}
        </button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "var(--risk-critical)" }}>{error}</p>}

      {showFarmForm && (
        <form onSubmit={createFarm} className="bg-white rounded-xl border p-5 mb-6 grid sm:grid-cols-2 gap-3" style={{ borderColor: "var(--border)" }}>
          <Field name="farm_name" label="Farm Name" required />
          <Field name="village" label="Village" required />
          <Field name="block" label="Block/Taluka" required />
          <Field name="district" label="District" required defaultValue="Thane" />
          <Field name="latitude" label="Latitude" type="number" step="any" required defaultValue="19.3006" />
          <Field name="longitude" label="Longitude" type="number" step="any" required defaultValue="72.8508" />
          <Field name="livestock_count" label="Livestock Count" type="number" defaultValue="5" />
          <div className="sm:col-span-2">
            <button className="rounded-lg px-4 py-2 text-white font-semibold text-sm" style={{ background: "var(--brand)" }}>Save Farm</button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {farms.map((farm) => (
          <div key={farm.id} className="bg-white rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{farm.farm_name}</h3>
                <p className="text-xs" style={{ color: "var(--ink-soft)" }}>{farm.village}, {farm.district} · {farm.livestock_count} livestock</p>
              </div>
              <button
                onClick={() => setShowAnimalForm(showAnimalForm === farm.id ? null : farm.id)}
                className="text-xs px-3 py-1.5 rounded-md border font-semibold"
                style={{ borderColor: "var(--brand)", color: "var(--brand)" }}
              >
                {showAnimalForm === farm.id ? "Cancel" : "+ Register Animal"}
              </button>
            </div>

            {herdSummaries[farm.id] && (
              <div className="mt-4 pt-4 border-t grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ borderColor: "var(--border)" }}>
                <Stat label="Animals" value={herdSummaries[farm.id].total_animals} />
                <Stat label="Affected" value={herdSummaries[farm.id].affected_animals} />
                <Stat label="Active cases" value={herdSummaries[farm.id].active_disease_cases} />
                <Stat label="Vaccinated" value={`${herdSummaries[farm.id].vaccination_coverage_pct}%`} />
                <div className="col-span-2 sm:col-span-4 flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Herd risk:</span>
                  {herdSummaries[farm.id].herd_risk.herd_risk_level === "INSUFFICIENT_DATA" ? (
                    <span className="text-xs" style={{ color: "var(--ink-soft)" }}>Insufficient data</span>
                  ) : (
                    <RiskBadge level={herdSummaries[farm.id].herd_risk.herd_risk_level} size="sm" />
                  )}
                </div>
                {herdSummaries[farm.id].herd_risk.reasons?.length > 0 && (
                  <p className="col-span-2 sm:col-span-4 text-xs" style={{ color: "var(--ink-soft)" }}>
                    {herdSummaries[farm.id].herd_risk.reasons.join(" · ")}
                  </p>
                )}
              </div>
            )}

            {showAnimalForm === farm.id && (
              <form onSubmit={(e) => createAnimal(e, farm.id)} className="mt-4 grid sm:grid-cols-3 gap-3 border-t pt-4" style={{ borderColor: "var(--border)" }}>
                <Field name="tag_id" label="Tag / RFID ID" required />
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Species</label>
                  <select name="species" className="w-full rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "var(--border)" }}>
                    <option value="cattle">Cattle</option>
                    <option value="buffalo">Buffalo</option>
                    <option value="goat">Goat</option>
                    <option value="sheep">Sheep</option>
                    <option value="poultry">Poultry</option>
                  </select>
                </div>
                <Field name="breed" label="Breed" />
                <Field name="age_months" label="Age (months)" type="number" defaultValue="24" />
                <div>
                  <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>Sex</label>
                  <select name="sex" className="w-full rounded-lg border px-3 py-2 bg-white" style={{ borderColor: "var(--border)" }}>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <button className="rounded-lg px-4 py-2 text-white font-semibold text-sm" style={{ background: "var(--brand)" }}>Save Animal</button>
                </div>
              </form>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {(animals[farm.id] || []).map((a) => (
                <span key={a.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--surface-alt)" }}>
                  {a.tag_id} · {a.species}
                </span>
              ))}
              {(animals[farm.id] || []).length === 0 && (
                <span className="text-xs" style={{ color: "var(--ink-soft)" }}>No animals registered yet.</span>
              )}
            </div>
          </div>
        ))}
        {farms.length === 0 && !showFarmForm && (
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>No farms yet. Add your first farm to get started.</p>
        )}
      </div>
    </PortalShell>
  );
}

function Field({ name, label, type = "text", required, defaultValue, step }: any) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{label}</label>
      <input
        name={name} type={type} required={required} defaultValue={defaultValue} step={step}
        className="w-full rounded-lg border px-3 py-2 bg-white outline-none focus:ring-2"
        style={{ borderColor: "var(--border)" }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-lg font-display" style={{ color: "var(--ink)" }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--ink-soft)" }}>{label}</div>
    </div>
  );
}
