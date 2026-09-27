"use client";
import { useEffect, useState } from "react";
import PortalShell from "@/components/PortalShell";
import { useRequireRole } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";

const ROLES = ["FARMER", "FIELD_WORKER", "VETERINARIAN", "LAB_STAFF", "DISTRICT_ADMIN", "STATE_ADMIN", "SUPER_ADMIN"];

export default function UsersPage() {
  const { user, loading } = useRequireRole(["SUPER_ADMIN", "STATE_ADMIN", "DISTRICT_ADMIN"]);
  const [users, setUsers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setUsers(await api.get("/api/v1/users"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load users — check your connection.");
    }
  }
  useEffect(() => { if (user) refresh(); }, [user]);

  async function createUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/api/v1/users", {
        name: fd.get("name"), email: fd.get("email"), password: fd.get("password"),
        role: fd.get("role"), district: fd.get("district"),
      });
      setShowForm(false);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create user");
    }
  }

  if (loading || !user) return null;

  return (
    <PortalShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl" style={{ color: "var(--ink)" }}>Users & Roles</h1>
        {user.role === "SUPER_ADMIN" && (
          <button onClick={() => setShowForm(!showForm)} className="rounded-lg px-4 py-2 text-white font-semibold text-sm" style={{ background: "var(--brand)" }}>
            {showForm ? "Cancel" : "+ Add User"}
          </button>
        )}
      </div>

      {error && <p className="text-sm mb-4" style={{ color: "var(--risk-critical)" }}>{error}</p>}

      {showForm && (
        <form onSubmit={createUser} className="bg-white rounded-xl border p-5 mb-6 grid sm:grid-cols-2 gap-3" style={{ borderColor: "var(--border)" }}>
          <input name="name" placeholder="Full name" required className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
          <input name="email" type="email" placeholder="Email" required className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
          <input name="password" type="password" placeholder="Password" required className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }} />
          <select name="role" className="rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
            {ROLES.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
          </select>
          <input name="district" placeholder="District" className="rounded-lg border px-3 py-2 sm:col-span-2" style={{ borderColor: "var(--border)" }} />
          <div className="sm:col-span-2">
            <button className="rounded-lg px-4 py-2 text-white font-semibold text-sm" style={{ background: "var(--brand)" }}>Create User</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b" style={{ borderColor: "var(--border)", background: "var(--surface-alt)" }}>
              <th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">District</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-b-0" style={{ borderColor: "var(--border)" }}>
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.role?.replaceAll("_", " ")}</td>
                <td className="p-3">{u.district}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PortalShell>
  );
}
