"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DemoNotice, ErrorState, LoadingState } from "@/components/app/empty-state";
import { apiGet, apiSend, formatDate } from "@/lib/api-client";
import type { LandRecord, Role, Settings, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const WEIGHT_META = [
  { key: "text_integrity", label: "Text integrity", hint: "Document confidence, OCR quality, field completeness" },
  { key: "text_map_consistency", label: "Text-to-map consistency", hint: "Area, share, subdivision and land-use agreement" },
  { key: "ground_truth_match", label: "Ground-truth match", hint: "Satellite and ground evidence corroboration" },
  { key: "change_audit_history", label: "Change & audit history", hint: "Boundary shifts, epochs and evidence completeness" },
] as const;

const ROLES: Role[] = ["citizen", "surveyor", "officer", "admin"];

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [revalidating, setRevalidating] = useState(false);
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResult, settingsResult] = await Promise.all([
        apiGet<{ users: User[] }>("/api/admin/users"),
        apiGet<{ settings: Settings }>("/api/admin/settings"),
      ]);
      setUsers(usersResult.users);
      setSettings(settingsResult.settings);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const weightTotal = useMemo(
    () => (settings ? Object.values(settings.weights).reduce((sum, value) => sum + Number(value || 0), 0) : 0),
    [settings]
  );
  const weightsValid = Math.abs(weightTotal - 100) < 0.01;

  function updateWeight(key: keyof Settings["weights"], value: string) {
    setSettings((current) =>
      current ? { ...current, weights: { ...current.weights, [key]: Number(value) } } : current
    );
  }

  function updateThreshold(key: keyof Settings["thresholds"], value: string) {
    setSettings((current) =>
      current ? { ...current, thresholds: { ...current.thresholds, [key]: Number(value) } } : current
    );
  }

  async function saveSettings() {
    if (!settings) return;
    if (!weightsValid) {
      toast.error("Weights must total exactly 100%.");
      return;
    }
    if (settings.thresholds.auto_verify <= settings.thresholds.officer_review) {
      toast.error("The auto-verification threshold must be greater than the officer-review threshold.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiSend<{ settings: Settings }>("/api/admin/settings", "PUT", settings);
      setSettings(result.settings);
      toast.success("Scoring configuration saved", { description: "Run a revalidation to apply the new weights to every record." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function revalidateAll() {
    setRevalidating(true);
    try {
      const { records } = await apiGet<{ records: LandRecord[] }>("/api/records");
      for (const record of records) {
        await apiSend(`/api/validation/run/${record.id}`, "POST");
      }
      toast.success("All records revalidated", { description: `${records.length} records were rescored with the current weights and thresholds.` });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRevalidating(false);
    }
  }

  async function updateUser(user: User, patch: { role?: Role; is_active?: boolean }) {
    setPendingUser(user.id);
    try {
      const result = await apiSend<{ user: User }>(`/api/admin/users/${user.id}`, "PUT", patch);
      setUsers((current) => current.map((entry) => (entry.id === result.user.id ? result.user : entry)));
      toast.success("User updated", { description: `${result.user.full_name} · ${result.user.role}` });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPendingUser(null);
    }
  }

  async function resetDemo() {
    setResetting(true);
    try {
      await apiSend("/api/admin/reset", "POST");
      await load();
      toast.success("Demo dataset restored", { description: "Records, scores, receipts, settings and users were reset to their seeded state." });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setResetting(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader eyebrow="Administration" title="Administration" description="Scoring configuration, user roles and demo data management." />
        <ErrorState message={error} onRetry={load} />
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-[11px] text-blue-900">
          Administration is restricted to the administrator role. Sign in with <span className="font-mono">admin@bhumidemo.in</span> (password <span className="font-mono">demo123</span>) to manage the workspace.
        </div>
      </div>
    );
  }

  if (loading || !settings) return <LoadingState title="Loading administration" description="Fetching users and scoring configuration." />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Administration"
        description="Tune the explainable scoring model, manage demo users and restore the seeded dataset. Every change is written to the audit trail."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className={cn("mr-1.5 h-4 w-4", loading && "animate-spin")} /> Refresh
          </Button>
        }
      />

      <DemoNotice />

      <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-1.5 text-sm"><SlidersHorizontal className="h-4 w-4 text-emerald-700" /> Parcel Trust Score weights</CardTitle>
              <p className="text-[11px] text-slate-500">Weights must total exactly 100%</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                weightsValid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {weightTotal}% / 100%
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {WEIGHT_META.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={item.key} className="text-[11px] font-medium text-slate-700">{item.label}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      id={item.key}
                      type="number"
                      min={0}
                      max={100}
                      value={settings.weights[item.key]}
                      onChange={(e) => updateWeight(item.key, e.target.value)}
                      className="h-8 w-20 text-right text-xs"
                    />
                    <span className="text-[10px] text-slate-400">%</span>
                  </div>
                </div>
                <div className="text-[10px] text-slate-400">{item.hint}</div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  value={settings.weights[item.key]}
                  onChange={(e) => updateWeight(item.key, e.target.value)}
                  className="h-1.5 w-full accent-emerald-600"
                  aria-label={`${item.label} weight slider`}
                />
              </div>
            ))}

            <div className="my-2 border-t border-slate-100" />

            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Routing thresholds</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="auto_verify" className="text-[11px]">Auto-verification eligible ≥</Label>
                  <Input id="auto_verify" type="number" value={settings.thresholds.auto_verify} onChange={(e) => updateThreshold("auto_verify", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="officer_review" className="text-[11px]">Officer review ≥</Label>
                  <Input id="officer_review" type="number" value={settings.thresholds.officer_review} onChange={(e) => updateThreshold("officer_review", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="area_mismatch_pct" className="text-[11px]">Area mismatch tolerance (%)</Label>
                  <Input id="area_mismatch_pct" type="number" value={settings.thresholds.area_mismatch_pct} onChange={(e) => updateThreshold("area_mismatch_pct", e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ocr_confidence" className="text-[11px]">Minimum OCR confidence</Label>
                  <Input id="ocr_confidence" type="number" value={settings.thresholds.ocr_confidence} onChange={(e) => updateThreshold("ocr_confidence", e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
              <div>
                <div className="text-[11px] font-medium text-slate-700">Demo mode</div>
                <div className="text-[10px] text-slate-400">Marks the workspace as illustrative in exports and notices.</div>
              </div>
              <Switch checked={settings.demo_mode} onCheckedChange={(checked) => setSettings({ ...settings, demo_mode: checked })} />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={saveSettings} disabled={saving || !weightsValid} className="bg-[#14532d] hover:bg-[#166534]">
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                {saving ? "Saving…" : "Save configuration"}
              </Button>
              <Button variant="outline" onClick={revalidateAll} disabled={revalidating || !weightsValid}>
                {revalidating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
                {revalidating ? "Revalidating…" : "Revalidate all records"}
              </Button>
            </div>

            {!weightsValid && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] text-red-800">
                <AlertTriangle className="h-3.5 w-3.5" /> Weights currently total {weightTotal}%. Adjust them to exactly 100% before saving.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm"><Users className="h-4 w-4 text-emerald-700" /> Demo users</CardTitle>
              <p className="text-[11px] text-slate-500">Change roles or deactivate accounts. All use password demo123.</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {users.map((user) => (
                <div key={user.id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-slate-900">{user.full_name}</div>
                      <div className="truncate text-[10px] text-slate-500">{user.email}</div>
                      <div className="text-[9px] text-slate-400">Added {formatDate(user.created_at)}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pendingUser === user.id && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                      <Switch
                        checked={Boolean(user.is_active)}
                        onCheckedChange={(checked) => updateUser(user, { is_active: checked })}
                        aria-label={`Toggle ${user.full_name}`}
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) => updateUser(user, { role: e.target.value as Role })}
                      className="h-7 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-700"
                      aria-label={`Role for ${user.full_name}`}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <Badge variant="outline" className={cn("text-[9px]", user.is_active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500")}>
                      {user.is_active ? "active" : "inactive"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-1.5 text-sm text-amber-900"><RotateCcw className="h-4 w-4" /> Reset demo dataset</CardTitle>
              <p className="text-[11px] text-amber-800">Restore the original 7 parcels, 4 users, scores and receipts.</p>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              <div className="rounded-lg border border-amber-200 bg-white/70 p-2.5 text-[10px] leading-4 text-amber-900">
                This deletes every change made in the workspace, including uploads, decisions and custom weights. Use it to return to a clean demonstration state.
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full border-amber-300 text-amber-800 hover:bg-amber-100" disabled={resetting}>
                    {resetting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                    {resetting ? "Resetting…" : "Reset to seeded demo data"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset the entire demo workspace?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This restores the seeded users, records, documents, validation findings, Trust Scores, receipts and settings. Any work created during the demo will be lost.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={resetDemo} className="bg-[#14532d] hover:bg-[#166534]">Reset dataset</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-2 p-3 text-[10px] leading-4 text-slate-500">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-800"><ShieldCheck className="h-3.5 w-3.5 text-emerald-700" /> Governance notes</div>
              <p>Weight changes affect future calculations only after a revalidation. Thresholds route records but never certify them.</p>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Weights must total 100%.</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Every settings change is audited.</div>
              <Link href="/reports" className="inline-flex items-center gap-0.5 text-emerald-700 hover:underline">Export the register <UserCog className="h-3 w-3" /></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
