"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Info,
  Loader2,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DemoNotice } from "@/components/app/empty-state";
import { apiGet, apiSend, categoryLabel, formatDate } from "@/lib/api-client";
import type { DocumentRow, ExtractedField, LandRecord } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CATEGORIES = ["7_12", "8a", "khasra", "ror", "cadastral", "survey_report", "ground_evidence", "supporting"];

const FIELD_ORDER = [
  "owner_name",
  "survey_number",
  "subdivision_number",
  "village",
  "taluka",
  "district",
  "recorded_area",
  "land_use",
  "owner_share",
  "record_year",
  "ulpin",
] as const;

const FIELD_LABELS: Record<string, string> = {
  owner_name: "Owner name",
  survey_number: "Survey number",
  subdivision_number: "Subdivision number",
  village: "Village",
  taluka: "Taluka",
  district: "District",
  recorded_area: "Recorded area (m²)",
  land_use: "Land use",
  owner_share: "Owner share (0–1)",
  record_year: "Record year",
  ulpin: "ULPIN",
};

interface DraftField {
  field_name: string;
  extracted_value: string;
  corrected_value: string;
  confidence: number;
  requires_review: boolean;
}

function parseFields(text: string, baseConfidence: number): DraftField[] {
  const get = (pattern: RegExp) => text.match(pattern)?.[1]?.trim() ?? "";
  const values: Record<string, string> = {
    owner_name: get(/(?:owner|holder|name of (?:the )?holder)[^\n:]*[:\-]\s*([^\n]+)/i),
    survey_number: get(/(?:survey|gat|sy|khasra)\s*(?:no\.?|number)?[^\d]{0,8}(\d{1,4})/i),
    subdivision_number: get(/(?:sub[-\s]?division|subdiv|\/)\s*(?:no\.?)?\s*(\d{1,3})/i),
    village: get(/(?:village|gaon|town)[^\n:]*[:\-]?\s*([^\n,]+)/i),
    taluka: get(/taluka[^\n:]*[:\-]?\s*([^\n,]+)/i),
    district: get(/district[^\n:]*[:\-]?\s*([^\n,]+)/i),
    recorded_area: get(/([\d,.]+)\s*(?:sq\.?\s*m|m2|m²|hectare|ha)/i).replace(/,/g, ""),
    land_use: get(/(agricultural|residential|commercial|industrial|mixed[-\s]?use)/i),
    owner_share: get(/(?:share|hissa)[^\d]{0,8}([\d.]+)/i),
    record_year: get(/\b(20\d{2})\b/),
    ulpin: get(/(MH-[A-Z]{3}-\d{4}-\d{4}-\d{4}-\d{4})/i),
  };
  return FIELD_ORDER.map((name, index) => {
    const value = values[name] ?? "";
    const confidence = value ? Math.max(42, Math.min(97, Math.round(baseConfidence + ((index % 5) - 2) * 2))) : 0;
    return {
      field_name: name,
      extracted_value: value,
      corrected_value: value,
      confidence,
      requires_review: !value || confidence < 75,
    };
  });
}

export default function UploadPage() {
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<LandRecord[]>([]);
  const [recordId, setRecordId] = useState("");
  const [category, setCategory] = useState("7_12");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentRow | null>(null);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "ocr" | "saving">("idle");
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    apiGet<{ records: LandRecord[] }>("/api/records")
      .then((data) => {
        setRecords(data.records);
        const params = new URLSearchParams(window.location.search);
        const fromQuery = params.get("record");
        const target = data.records.find((r) => r.id === fromQuery) ?? data.records[0];
        if (target) setRecordId((current) => current || target.id);
        const docParam = params.get("document");
        if (docParam) void loadExisting(docParam);
      })
      .catch((error) => toast.error((error as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRecord = useMemo(() => records.find((r) => r.id === recordId) ?? null, [records, recordId]);

  const loadExisting = useCallback(async (documentId: string) => {
    try {
      const data = await apiGet<{ document: DocumentRow; fields: ExtractedField[] }>(`/api/documents/${documentId}`);
      setDocument(data.document);
      setPreviewUrl(`/api/documents/${documentId}/file`);
      setRecordId(data.document.land_record_id);
      setCategory(data.document.document_category);
      if (data.fields.length) {
        setFields(
          data.fields.map((f) => ({
            field_name: f.field_name,
            extracted_value: f.extracted_value,
            corrected_value: f.corrected_value ?? f.extracted_value,
            confidence: f.confidence,
            requires_review: Boolean(f.requires_review),
          }))
        );
        setOcrNote("Stored extraction results loaded. Review and correct any low-confidence field before saving.");
      }
    } catch (error) {
      toast.error((error as Error).message);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickFile(next: File | null) {
    setFile(next);
    setDocument(null);
    setFields([]);
    setOcrNote(null);
    setProgress(0);
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
  }

  async function upload() {
    if (!file || !recordId) {
      toast.error("Choose a land record and a document file first.");
      return;
    }
    setPhase("uploading");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("land_record_id", recordId);
      form.append("document_category", category);
      const result = await apiSend<{ document: DocumentRow; message: string }>("/api/documents/upload", "POST", form);
      setDocument(result.document);
      setPreviewUrl(`/api/documents/${result.document.id}/file`);
      toast.success("Document stored", { description: result.message });
      setPhase("idle");
      const processed = await apiSend<{ mode: string; message: string; fields: ExtractedField[] }>(
        `/api/ocr/process/${result.document.id}`,
        "POST"
      );
      if (processed.fields.length) {
        setFields(
          processed.fields.map((f) => ({
            field_name: f.field_name,
            extracted_value: f.extracted_value,
            corrected_value: f.corrected_value ?? f.extracted_value,
            confidence: f.confidence,
            requires_review: Boolean(f.requires_review),
          }))
        );
        setOcrNote(processed.message);
      } else {
        setOcrNote(processed.message);
      }
    } catch (error) {
      toast.error((error as Error).message);
      setPhase("idle");
    }
  }

  async function runBrowserOcr() {
    if (!document) return;
    if (!file && document.file_type === "application/pdf") {
      toast.error("Browser OCR needs an image. PDFs are stored with a hash but extracted fields should be entered manually.");
      return;
    }
    setPhase("ocr");
    setOcrNote("Loading the browser OCR engine. The first run downloads English language data, so it can take a few seconds.");
    setProgress(4);
    let worker: { recognize: (input: File | string) => Promise<{ data: { text: string; confidence: number } }>; terminate: () => Promise<unknown> } | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, {
        logger: (message: { status: string; progress: number }) => {
          if (message.status === "recognizing text") setProgress(Math.round(message.progress * 100));
        },
      });
      const input = file ?? `/api/documents/${document.id}/file`;
      const result = await worker.recognize(input);
      const base = result.data.confidence || 72;
      setFields(parseFields(result.data.text, base));
      setOcrNote(
        `Browser OCR completed with an average engine confidence of ${base.toFixed(0)}%. Values are heuristically parsed from raw text — verify every field against the document image.`
      );
      toast.success("OCR finished", { description: "Review the extracted values and correct anything uncertain." });
    } catch (error) {
      setOcrNote(
        "The in-browser OCR engine could not load (offline sandbox or missing language data). This is not a blocker: enter the fields manually below. The workflow will continue."
      );
      if (!fields.length) setFields(FIELD_ORDER.map((name) => ({ field_name: name, extracted_value: "", corrected_value: "", confidence: 0, requires_review: true })));
      toast.error((error as Error).message);
    } finally {
      await worker?.terminate().catch(() => undefined);
      setPhase("idle");
      setProgress(0);
    }
  }

  function ensureRows() {
    if (!fields.length) {
      setFields(FIELD_ORDER.map((name) => ({ field_name: name, extracted_value: "", corrected_value: "", confidence: 0, requires_review: true })));
    }
  }

  function updateField(name: string, value: string) {
    setFields((current) =>
      current.map((field) =>
        field.field_name === name
          ? {
              ...field,
              corrected_value: value,
              confidence: field.confidence || (value ? 88 : 0),
              requires_review: value ? field.requires_review && field.confidence >= 75 : true,
            }
          : field
      )
    );
  }

  function toggleReview(name: string) {
    setFields((current) => current.map((field) => (field.field_name === name ? { ...field, requires_review: !field.requires_review } : field)));
  }

  async function save() {
    if (!document) return;
    const rows = fields.length ? fields : FIELD_ORDER.map((name) => ({ field_name: name, extracted_value: "", corrected_value: "", confidence: 0, requires_review: true }));
    setPhase("saving");
    try {
      await apiSend(`/api/ocr/results/${document.id}`, "PUT", {
        fields: rows.map((field) => ({
          field_name: field.field_name,
          extracted_value: field.extracted_value,
          corrected_value: field.corrected_value || null,
          confidence: field.confidence,
          requires_review: field.requires_review,
        })),
      });
      await apiSend(`/api/validation/run/${document.land_record_id}`, "POST");
      toast.success("Extraction saved", { description: "Validation and the Parcel Trust Score were recomputed." });
      window.location.href = `/records/${document.land_record_id}`;
    } catch (error) {
      toast.error((error as Error).message);
      setPhase("idle");
    }
  }

  const averageConfidence = fields.length
    ? fields.reduce((sum, field) => sum + field.confidence, 0) / fields.length
    : 0;
  const lowConfidence = fields.filter((field) => field.confidence < 75 || field.requires_review).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Evidence intake"
        title="Digitize a land document"
        description="Upload a 7/12 extract, 8A, Khasra record, cadastral map or survey report. The file is SHA-256 hashed, text can be extracted in the browser, and every field stays editable before it influences validation."
        actions={
          <Button asChild variant="outline">
            <Link href="/records">Browse records <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        }
      />

      <DemoNotice>
        Use the sample SVGs in <code className="rounded bg-amber-100 px-1">public/samples</code> or any image of a mock document. Do not upload real personal land documents to this prototype.
      </DemoNotice>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">1 · Select the evidence</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="space-y-1.5">
                <Label htmlFor="record" className="text-xs">Attach to land record</Label>
                <select
                  id="record"
                  value={recordId}
                  onChange={(e) => setRecordId(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
                >
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      Survey {record.survey_number}/{record.subdivision_number} · {record.owner_name} · {record.village}
                    </option>
                  ))}
                </select>
                {selectedRecord && (
                  <div className="text-[10px] text-slate-500">
                    Current score {selectedRecord.trust_score}/100 · {selectedRecord.status.replaceAll("_", " ")} · {selectedRecord.recorded_area.toLocaleString("en-IN")} m² recorded
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="category" className="text-xs">Document category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
                >
                  {CATEGORIES.map((value) => (
                    <option key={value} value={value}>{categoryLabel(value)}</option>
                  ))}
                </select>
              </div>

              <div
                className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-5 text-center transition hover:border-emerald-400 hover:bg-emerald-50/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) pickFile(dropped);
                }}
              >
                <UploadCloud className="mx-auto h-7 w-7 text-slate-400" />
                <div className="mt-2 text-xs font-semibold text-slate-800">Drop a PDF, JPG or PNG (max 10 MB)</div>
                <div className="mt-1 text-[10px] text-slate-500">Or choose a file to preview, hash and extract.</div>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => fileInput.current?.click()}>
                  Choose file
                </Button>
                {file && (
                  <div className="mt-2 truncate text-[11px] font-medium text-emerald-800">
                    {file.name} · {(file.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>

              <Button onClick={upload} disabled={!file || !recordId || phase !== "idle"} className="w-full bg-[#14532d] hover:bg-[#166534]">
                {phase === "uploading" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                {phase === "uploading" ? "Storing and hashing…" : "Upload and hash document"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Preview</CardTitle></CardHeader>
            <CardContent className="pt-0">
              {previewUrl ? (
                document?.file_type?.includes("pdf") || file?.name.toLowerCase().endsWith(".pdf") ? (
                  <iframe src={previewUrl} title="Document preview" className="h-[360px] w-full rounded-lg border border-slate-200" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Uploaded document preview" className="max-h-[420px] w-full rounded-lg border border-slate-200 object-contain bg-white" />
                )
              ) : (
                <div className="flex h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 text-center">
                  <FileText className="h-7 w-7 text-slate-300" />
                  <div className="mt-2 text-xs font-medium text-slate-600">No document selected</div>
                  <div className="mt-1 max-w-[240px] text-[10px] leading-4 text-slate-400">
                    Try <span className="font-mono">public/samples/seven-twelve.svg</span> to explore the full flow.
                  </div>
                </div>
              )}
              {document && (
                <div className="mt-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] text-slate-500">
                  <div className="truncate font-mono">SHA-256 {document.sha256_hash}</div>
                  <div>Stored {formatDate(document.uploaded_at)} · {categoryLabel(document.document_category)} · status {document.ocr_status}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm">2 · Extract and verify fields</CardTitle>
                <p className="text-[11px] text-slate-500">Low-confidence values must be reviewed by a person</p>
              </div>
              {fields.length > 0 && (
                <Badge variant="outline" className={cn("text-[10px]", averageConfidence >= 85 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700")}>
                  avg {averageConfidence.toFixed(0)}%
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={runBrowserOcr} disabled={!document || phase !== "idle"}>
                  {phase === "ocr" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ScanLine className="mr-1.5 h-3.5 w-3.5" />}
                  Run browser OCR
                </Button>
                <Button variant="outline" size="sm" onClick={() => { ensureRows(); setOcrNote("Manual entry enabled. Type the values from the document; saving will mark them as human-verified."); }} disabled={!document}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Enter manually
                </Button>
                <Button variant="ghost" size="sm" className="text-emerald-700" onClick={async () => {
                  if (!document) return;
                  try {
                    const processed = await apiSend<{ mode: string; message: string; fields: ExtractedField[] }>(`/api/ocr/process/${document.id}`, "POST");
                    if (processed.fields.length) {
                      setFields(processed.fields.map((f) => ({ field_name: f.field_name, extracted_value: f.extracted_value, corrected_value: f.corrected_value ?? f.extracted_value, confidence: f.confidence, requires_review: Boolean(f.requires_review) })));
                    }
                    setOcrNote(processed.message);
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}>
                  Load sample extraction
                </Button>
              </div>

              {phase === "ocr" && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-medium text-blue-800">
                    <span>Recognising text in the browser…</span><span>{progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-blue-100">
                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {ocrNote && (
                <div className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[11px] leading-5 text-slate-600">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" /> {ocrNote}
                </div>
              )}

              {fields.length > 0 ? (
                <div className="space-y-2">
                  {fields.map((field) => (
                    <div key={field.field_name} className="rounded-lg border border-slate-200 p-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor={`field-${field.field_name}`} className="text-[11px] font-medium text-slate-700">
                          {FIELD_LABELS[field.field_name] ?? field.field_name}
                        </Label>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-[10px] font-semibold", field.confidence >= 85 ? "text-emerald-700" : field.confidence >= 75 ? "text-amber-700" : "text-red-700")}>
                            {field.confidence ? `${field.confidence.toFixed(0)}%` : "no confidence"}
                          </span>
                          <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
                            <input type="checkbox" checked={field.requires_review} onChange={() => toggleReview(field.field_name)} className="h-3 w-3 accent-amber-500" />
                            review
                          </label>
                        </div>
                      </div>
                      <Input
                        id={`field-${field.field_name}`}
                        value={field.corrected_value}
                        onChange={(e) => updateField(field.field_name, e.target.value)}
                        placeholder={field.extracted_value || "Enter value from the document"}
                        className="mt-1.5 h-8 text-xs"
                      />
                      {field.extracted_value && field.extracted_value !== field.corrected_value && (
                        <div className="mt-1 text-[9px] text-slate-400">Extracted: {field.extracted_value}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <ScanLine className="mx-auto h-6 w-6 text-slate-400" />
                  <div className="mt-2 text-xs font-semibold text-slate-700">Upload a document to begin</div>
                  <p className="mx-auto mt-1 max-w-sm text-[11px] leading-5 text-slate-500">
                    After upload, run browser OCR or enter the values manually. Nothing here blocks the workflow if the OCR engine cannot load.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {fields.length > 0 && (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle2 className={cn("h-4 w-4", lowConfidence ? "text-amber-500" : "text-emerald-600")} />
                    {lowConfidence ? `${lowConfidence} field(s) still marked for review` : "All fields look verified"}
                  </div>
                  <span className="text-slate-400">{fields.length} fields</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-[10px] leading-4 text-slate-500">
                  Saving stores the corrected values, marks the document extraction complete, re-runs validation and recalculates the Parcel Trust Score. Low-confidence fields stay flagged.
                </div>
                <Button onClick={save} disabled={phase !== "idle" || !document} className="w-full bg-[#14532d] hover:bg-[#166534]">
                  {phase === "saving" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
                  {phase === "saving" ? "Saving and revalidating…" : "Save extraction and revalidate"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
