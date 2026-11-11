"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Download, FolderSearch, Plus, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { DemoNotice, EmptyState, ErrorState, LoadingState } from "@/components/app/empty-state";
import { trustTone } from "@/components/app/trust-score";
import { useApi } from "@/hooks/use-api";
import { apiSend, formatDateShort } from "@/lib/api-client";
import type { LandRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type RecordRow = LandRecord & { flag_count: number; document_count: number };

type SortKey = "survey" | "owner" | "score" | "updated" | "area";

const emptyForm = {
  survey_number: "",
  subdivision_number: "",
  owner_name: "",
  village: "Parbhani",
  taluka: "Parbhani",
  district: "Parbhani",
  recorded_area: "",
  land_use: "Agricultural",
};

export default function RecordsPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi<{ records: RecordRow[] }>("/api/records");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [asc, setAsc] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const records = data?.records ?? [];

  const filtered = useMemo(() => {
    const list = records.filter((record) => {
      if (status !== "all" && record.status !== status) return false;
      if (!query) return true;
      const haystack = `${record.survey_number}/${record.subdivision_number} ${record.ulpin} ${record.owner_name} ${record.village}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
    const sorted = [...list].sort((a, b) => {
      let result = 0;
      if (sort === "survey") result = `${a.survey_number}/${a.subdivision_number}`.localeCompare(`${b.survey_number}/${b.subdivision_number}`, undefined, { numeric: true });
      if (sort === "owner") result = a.owner_name.localeCompare(b.owner_name);
      if (sort === "score") result = a.trust_score - b.trust_score;
      if (sort === "area") result = a.recorded_area - b.recorded_area;
      if (sort === "updated") result = a.updated_at.localeCompare(b.updated_at);
      return asc ? result : -result;
    });
    return sorted;
  }, [records, query, status, sort, asc]);

  async function createRecord() {
    if (!form.survey_number || !form.subdivision_number || !form.owner_name || !form.recorded_area) {
      toast.error("Survey number, subdivision, owner and recorded area are required.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiSend<{ id: string }>("/api/records", "POST", {
        ...form,
        recorded_area: Number(form.recorded_area),
      });
      toast.success("Record created", { description: "Validation and a provisional Trust Score were generated." });
      setOpen(false);
      setForm(emptyForm);
      router.push(`/records/${result.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Register"
        title="Land records"
        description="Every parcel in the demo dataset with its evidence count, validation findings and provisional Parcel Trust Score."
        actions={
          <>
            <Button asChild variant="outline">
              <a href="/api/reports/records/csv">
                <Download className="mr-1.5 h-4 w-4" /> Export CSV
              </a>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#14532d] hover:bg-[#166534]">
                  <Plus className="mr-1.5 h-4 w-4" /> New record
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create a demo land record</DialogTitle>
                  <DialogDescription>
                    The record is saved to the prototype database, validated immediately and scored. All values are illustrative.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    ["survey_number", "Survey number", "125"],
                    ["subdivision_number", "Subdivision", "1"],
                    ["owner_name", "Owner name", "Demo Owner E"],
                    ["recorded_area", "Recorded area (m²)", "850"],
                  ].map(([key, label, placeholder]) => (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={key} className="text-xs">{label}</Label>
                      <Input
                        id={key}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        type={key === "recorded_area" ? "number" : "text"}
                      />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label htmlFor="village" className="text-xs">Village</Label>
                    <Input id="village" value={form.village} onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="land_use" className="text-xs">Land use</Label>
                    <select
                      id="land_use"
                      value={form.land_use}
                      onChange={(e) => setForm((f) => ({ ...f, land_use: e.target.value }))}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-sm"
                    >
                      <option>Agricultural</option>
                      <option>Residential</option>
                      <option>Commercial</option>
                      <option>Industrial</option>
                      <option>Mixed use</option>
                    </select>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-5 text-amber-900">
                  A new record starts as <strong>Digitized</strong> with no documents or geometry, so its score will be provisional until evidence is attached.
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={createRecord} disabled={saving} className="bg-[#14532d] hover:bg-[#166534]">
                    {saving ? "Creating…" : "Create and validate"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <DemoNotice />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by survey number, ULPIN, owner or village"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="eligible_auto_verification">Auto-eligible</option>
              <option value="needs_officer_review">Officer review</option>
              <option value="escalate_resurvey">Escalate</option>
              <option value="correction_requested">Correction requested</option>
              <option value="digitized">Digitized</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              aria-label="Sort records"
            >
              <option value="updated">Last updated</option>
              <option value="score">Trust score</option>
              <option value="survey">Survey number</option>
              <option value="owner">Owner name</option>
              <option value="area">Recorded area</option>
            </select>
            <Button variant="outline" size="sm" className="h-9" onClick={() => setAsc((v) => !v)}>
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /> {asc ? "Ascending" : "Descending"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <LoadingState title="Loading register" />}

      {!loading && !filtered.length && (
        <EmptyState
          title="No records found"
          description="Try a different search term or clear the status filter. Administrators can restore the seeded demo dataset from Administration."
          action={<Button variant="outline" onClick={() => { setQuery(""); setStatus("all"); }}>Clear filters</Button>}
        />
      )}

      {!loading && filtered.length > 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/60 text-[10px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Survey / ULPIN</th>
                    <th className="px-3 py-2.5 font-medium">Owner</th>
                    <th className="hidden px-3 py-2.5 font-medium md:table-cell">Village</th>
                    <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Land use</th>
                    <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Recorded / mapped</th>
                    <th className="px-3 py-2.5 font-medium">Trust</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="hidden px-3 py-2.5 font-medium lg:table-cell">Evidence</th>
                    <th className="px-3 py-2.5 font-medium text-right">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 last:border-0 hover:bg-emerald-50/30">
                      <td className="px-4 py-3">
                        <Link href={`/records/${record.id}`} className="font-semibold text-slate-900 hover:text-emerald-700">
                          Survey {record.survey_number}/{record.subdivision_number}
                        </Link>
                        <div className="font-mono text-[9px] text-slate-400">{record.ulpin}</div>
                        <div className="text-[10px] text-slate-400">Updated {formatDateShort(record.updated_at)}</div>
                      </td>
                      <td className="max-w-[170px] px-3 py-3">
                        <div className="truncate text-slate-700">{record.owner_name}</div>
                        <div className="text-[10px] text-slate-400">{record.record_year}</div>
                      </td>
                      <td className="hidden px-3 py-3 text-slate-500 md:table-cell">{record.village}</td>
                      <td className="hidden px-3 py-3 text-slate-500 sm:table-cell">{record.land_use}</td>
                      <td className="hidden px-3 py-3 lg:table-cell">
                        <div className="text-slate-700">{record.recorded_area.toLocaleString("en-IN")} m²</div>
                        <div className="text-[10px] text-slate-400">mapped {record.mapped_area.toLocaleString("en-IN")} m²</div>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("text-sm font-bold", trustTone(record.trust_score).text)}>{record.trust_score}</span>
                        <div className="text-[9px] text-slate-400">/100</div>
                      </td>
                      <td className="px-3 py-3"><StatusBadge status={record.status} /></td>
                      <td className="hidden px-3 py-3 text-slate-500 lg:table-cell">
                        {record.document_count} docs · {record.flag_count} findings
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 text-[11px] text-emerald-700">
                          <Link href={`/records/${record.id}`}>Open</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-sm">
          <FolderSearch className="mb-1.5 h-4 w-4 text-emerald-700" />
          {records.length} records in the demo register, all synthetic.
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-sm">
          <ShieldCheck className="mb-1.5 h-4 w-4 text-emerald-700" />
          Scores are provisional wherever evidence is incomplete.
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 shadow-sm">
          <ArrowUpDown className="mb-1.5 h-4 w-4 text-emerald-700" />
          Verification is a human decision, never an automatic one.
        </div>
      </div>
    </div>
  );
}
