export async function apiGet<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Request failed.");
  return data as T;
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string }).error || "Request failed.");
  return data as T;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "eligible_auto_verification":
      return "Eligible for auto-verification";
    case "needs_officer_review":
      return "Needs officer review";
    case "escalate_resurvey":
      return "Escalate / re-survey";
    case "verified":
      return "Verified (prototype)";
    case "rejected":
      return "Rejected";
    case "correction_requested":
      return "Correction requested";
    case "digitized":
      return "Digitized";
    default:
      return status.replaceAll("_", " ");
  }
}

export function categoryLabel(category: string): string {
  return (
    {
      ror: "Record of Rights",
      "7_12": "7/12 extract",
      "8a": "8A extract",
      khasra: "Khasra record",
      cadastral: "Cadastral map",
      survey_report: "Survey report",
      ground_evidence: "Ground evidence",
      supporting: "Supporting document",
    }[category] ?? category.replaceAll("_", " ")
  );
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}
