import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Database,
  FileSearch,
  FileText,
  Fingerprint,
  Layers3,
  LandPlot,
  Lock,
  MapPinned,
  ScanLine,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const capabilities = [
  {
    icon: ScanLine,
    title: "AI Land Record Digitization",
    text: "Upload 7/12, 8A, Khasra, map and survey evidence. OCR extracts structured fields in Marathi, Hindi and English with per-field confidence and manual correction.",
  },
  {
    icon: FileSearch,
    title: "Automated Land Record Validation",
    text: "Nine reason-coded checks compare record text, cadastral geometry and ground evidence — area, ownership, overlap, land use, boundary change and more.",
  },
  {
    icon: ShieldCheck,
    title: "Explainable Parcel Trust Score",
    text: "A transparent 0–100 score built from four weighted components. Every deduction and every evidence gap is shown, and human review remains mandatory.",
  },
  {
    icon: Layers3,
    title: "3D + 4D Digital Property Twin",
    text: "Explore ULPIN → parcel → building → floor → unit → utility, then move through survey epochs to see how boundaries and structures changed.",
  },
];

const workflow = [
  ["01", "Capture", "Upload records, maps and ground evidence.", FileText],
  ["02", "Digitize", "OCR extracts fields with confidence flags.", ScanLine],
  ["03", "Cross-check", "Text, geometry and ground truth are compared.", MapPinned],
  ["04", "Validate", "Reason-coded issues are generated.", TriangleAlert],
  ["05", "Score", "Explainable Trust Score routes the record.", ShieldCheck],
  ["06", "Review", "An officer approves, rejects or requests correction.", Users],
  ["07", "Certify", "A prototype receipt and SHA-256 seal are issued.", Fingerprint],
  ["08", "Visualize", "The linked 3D property and 4D history are published.", Building2],
] as const;

const tech = [
  "Next.js + TypeScript",
  "React 19 + Tailwind",
  "FastAPI-style API layer",
  "SQLite persistence",
  "Polygon geometry rules",
  "Tesseract.js OCR",
  "Recharts analytics",
  "SHA-256 audit seals",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#052e16]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-900/30">
              <LandPlot className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-wide text-white">
                BHŪMI <span className="text-emerald-400">3D</span>
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-200/70">Land intelligence</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-emerald-50/80 md:flex">
            <a className="transition hover:text-white" href="#problem">Problem</a>
            <a className="transition hover:text-white" href="#solution">Solution</a>
            <a className="transition hover:text-white" href="#workflow">Workflow</a>
            <a className="transition hover:text-white" href="#technology">Technology</a>
            <a className="transition hover:text-white" href="#team">Team</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="text-emerald-50 hover:bg-white/10 hover:text-white">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild className="bg-emerald-500 text-white hover:bg-emerald-400">
              <Link href="/login?demo=officer">
                Demo access <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="brand-gradient relative overflow-hidden">
        <div className="hero-grid absolute inset-0 opacity-70" />
        <div className="absolute -right-32 top-10 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div className="fade-up">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15">
                Smart India Hackathon 2026 · Prototype
              </Badge>
              <Badge className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                Ministry of Rural Development
              </Badge>
            </div>
            <h1 className="max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Land records that can be{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-lime-200 bg-clip-text text-transparent">trusted</span>, not just digitized.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              BHŪMI 3D connects fragmented records, cadastral maps and ground evidence into a validated,
              evidence-linked digital property identity — with 3D and historical 4D visualization.
            </p>
            <div className="mt-4 text-sm font-medium tracking-[0.18em] text-emerald-300">DIGITIZE · VALIDATE · TRUST</div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 bg-emerald-500 px-6 text-white hover:bg-emerald-400">
                <Link href="/login?demo=officer">
                  Enter the demo <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 border-white/20 bg-white/5 px-6 text-white hover:bg-white/10 hover:text-white">
                <a href="#workflow">See the workflow</a>
              </Button>
            </div>
            <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
              {[["82/100", "Main demo parcel"], ["9", "Validation rules"], ["3 epochs", "Illustrative 4D history"]].map(([value, label]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-lg font-semibold text-white">{value}</div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="fade-up-delay-1 relative">
            <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-emerald-400/20 to-blue-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/95 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="ml-3 text-xs font-medium text-slate-500">Parcel intelligence · 118/2</span>
                </div>
                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Needs review</Badge>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-[1fr_0.9fr]">
                <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400">
                    <span>Parcel Trust Score</span><ShieldCheck className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="mt-2 flex items-end gap-2"><span className="text-5xl font-bold tracking-tight">82</span><span className="mb-1 text-sm text-slate-400">/ 100</span></div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[82%] rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" /></div>
                  <div className="mt-4 space-y-2.5">
                    {[["Text integrity", 30, "bg-emerald-400"], ["Text-to-map consistency", 30, "bg-blue-400"], ["Ground-truth match", 25, "bg-amber-400"], ["Change & audit history", 15, "bg-violet-400"]].map(([label, weight, tone]) => (
                      <div key={String(label)}>
                        <div className="flex justify-between text-[10px] text-slate-300"><span>{label}</span><span>{weight}%</span></div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10"><div className={`h-full ${tone}`} style={{ width: `${Number(weight) * 2.4}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {[["Area mismatch", "+6% vs map", "bg-amber-500"], ["Built-up evidence", "34% detected", "bg-red-500"], ["Boundary change", "2025 → 2026", "bg-red-500"], ["Survey report", "Missing", "bg-slate-400"]].map(([label, value, dot]) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
                      <div className="mt-0.5 flex items-center justify-between text-xs font-medium text-slate-700">{value}<span className={`h-1.5 w-1.5 rounded-full ${dot}`} /></div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800"><Users className="h-3.5 w-3.5" /> Human decision required</div>
                    <div className="mt-0.5 text-[10px] text-emerald-700">AI never certifies independently.</div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-2.5 text-[10px] text-slate-500">
                <span>ULPIN MH-PBN-2026-0118-0002-0001</span><span>Illustrative demo data</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="problem" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">The problem</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Digitization alone does not make a land record correct.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Records of Rights, 7/12 extracts, 8A documents, Khasra records, cadastral maps and survey
              evidence live in separate formats and disconnected systems. Mapped geometry may not agree
              with recorded area. Ownership shares may not reconcile. Ground conditions may have moved on.
            </p>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="flex gap-2"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>A searchable scan is not a trusted record. Without cross-evidence validation, errors become digital errors.</p></div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Scanned & handwritten records", "Hard to search, match and audit across villages and years."],
              ["Fragmented identifiers", "Survey, subdivision, owner and ULPIN links are often incomplete."],
              ["Text vs map gaps", "Recorded area, shares and subdivision schedules may not reconcile."],
              ["Boundary & ground changes", "Overlaps, extensions and built-up development may be missing."],
              ["Multilingual entries", "Marathi, Hindi and English appear in the same document bundle."],
              ["No transparent review", "Corrections need an auditable, human-controlled process."],
            ].map(([title, text], i) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-xs font-bold text-red-600">0{i + 1}</div>
                <div className="text-sm font-semibold">{title}</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="solution" className="border-y border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">The solution</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">An evidence-backed digital property identity.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              BHŪMI 3D treats a land record as a claim to be tested — against the map, against the ground,
              and against its own history. Every result is explainable and every legal decision remains
              with an authorized officer.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((cap) => (
              <div key={cap.title} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm card-lift">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#14532d] text-white"><cap.icon className="h-5 w-5" /></div>
                <h3 className="mt-4 text-base font-semibold">{cap.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{cap.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">End-to-end workflow</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">From a scanned page to a time-aware property identity.</h2>
          </div>
          <div className="text-xs text-slate-500">Human review is built into the process, not bolted on.</div>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {workflow.map(([step, title, text, Icon]) => (
            <div key={step} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Step {step}</span><Icon className="h-4 w-4 text-emerald-700" /></div>
              <div className="text-sm font-semibold">{title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#0f172a] py-20">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Explainable by design</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">A score you can interrogate, not a black box.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-400">
              The Parcel Trust Score is a weighted composite of four independently calculated components.
              If evidence is missing, the score is marked provisional and the gap is displayed.
            </p>
            <div className="mt-6 space-y-3">
              {[["90 – 100", "Eligible for auto-verification under configured demo controls", "bg-emerald-500/15 text-emerald-300"], ["60 – 89", "Officer review required before correction or certification", "bg-amber-500/15 text-amber-300"], ["Below 60", "Escalate for re-survey and evidence remediation", "bg-red-500/15 text-red-300"]].map(([range, text, tone]) => (
                <div key={range} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <span className={`mt-0.5 inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${tone}`}>{range}</span>
                  <span className="text-xs leading-5 text-slate-300">{text}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-500">Prototype routing rules, not legal government approval rules. AI never modifies or certifies a government land record.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
            <div className="flex items-center justify-between">
              <div><div className="text-[10px] uppercase tracking-widest text-slate-400">Demo parcel 118/2</div><div className="mt-1 text-2xl font-bold text-white">82 <span className="text-sm font-normal text-slate-400">/ 100</span></div></div>
              <Badge className="border-amber-400/30 bg-amber-400/10 text-amber-200">Needs officer review</Badge>
            </div>
            <div className="mt-6 space-y-4">
              {[["Text integrity", 98, "30%", "bg-emerald-400"], ["Text-to-map consistency", 82, "30%", "bg-blue-400"], ["Ground-truth match", 64, "25%", "bg-amber-400"], ["Change & audit history", 80, "15%", "bg-violet-400"]].map(([label, score, weight, tone]) => (
                <div key={String(label)}>
                  <div className="flex justify-between text-xs text-slate-300"><span>{label}</span><span>{score}/100 · {weight}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${tone}`} style={{ width: `${score}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] leading-5 text-slate-400">
              Why not higher? Recorded area is 6% below the mapped area, sample ground evidence shows 34% built-up development on agricultural land, a 2025→2026 boundary shift was detected, and the survey report is missing.
            </div>
          </div>
        </div>
      </section>

      <section id="technology" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Built for the hackathon</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">A working prototype with transparent simulated data.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Real database operations drive records, documents, validation, scores, reviews and audit
              events. OCR runs in the browser with a manual fallback. Geometry checks use the same polygon
              maths a production system would use.
            </p>
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              <span className="font-semibold text-slate-700">Honest boundaries:</span> this prototype is not
              connected to Bhulekh, NGDRS or SVAMITVA. All names, identifiers, geometries, scores and
              histories are illustrative. No government API is claimed.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tech.map((name) => (
              <div key={name} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
                <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Database className="h-4 w-4" /></div>
                <div className="mt-2 text-[11px] font-medium leading-4 text-slate-700">{name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[["Citizens", "See a property's status, understand the evidence and download a summary."], ["Surveyors", "Submit ground evidence, inspect geometry and record field findings."], ["Revenue officers", "Review flagged records with full evidence and take an auditable decision."], ["Administrators", "Configure thresholds and weights, manage users and monitor the system."]].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <div className="mt-3 text-sm font-semibold">{title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="team" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[1fr_0.9fr]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">The team</div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight">Biocreate Innovators</h2>
            <p className="mt-2 text-sm text-slate-600">Shri Shivaji Institute of Engineering &amp; Management Studies, Parbhani</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Smart Governance", "Digital Public Infrastructure", "Geospatial intelligence", "Responsible AI"].map((tag) => (
                <Badge key={tag} variant="secondary" className="bg-emerald-50 text-emerald-800">{tag}</Badge>
              ))}
            </div>
            <div className="mt-5 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <div><span className="font-semibold text-slate-700">Ministry:</span> Ministry of Rural Development</div>
              <div><span className="font-semibold text-slate-700">Department:</span> Department of Land Resources</div>
              <div><span className="font-semibold text-slate-700">Theme:</span> Smart Governance / DPI</div>
              <div><span className="font-semibold text-slate-700">Event:</span> Smart India Hackathon 2026</div>
            </div>
          </div>
          <div className="rounded-xl bg-[#052e16] p-5 text-white">
            <div className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="h-4 w-4 text-emerald-400" /> Demo accounts</div>
            <div className="mt-3 space-y-2 text-xs">
              {[["Citizen", "citizen@bhumidemo.in"], ["Surveyor", "surveyor@bhumidemo.in"], ["Revenue officer", "officer@bhumidemo.in"], ["Administrator", "admin@bhumidemo.in"]].map(([role, email]) => (
                <div key={role} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                  <span className="text-slate-300">{role}</span><span className="font-mono text-[10px] text-emerald-300">{email}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-slate-400">Password for all demo accounts: <span className="font-mono text-slate-200">demo123</span></div>
            <Button asChild className="mt-4 w-full bg-emerald-500 text-white hover:bg-emerald-400"><Link href="/login">Open demo login <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#14532d] text-white"><LandPlot className="h-4 w-4" /></div>
            <div className="text-xs text-slate-500">
              <div className="font-semibold text-slate-800">BHŪMI 3D · Digitize · Validate · Trust</div>
              <div>Illustrative hackathon prototype. Not a government service.</div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400">© 2026 Biocreate Innovators · All demo data is fictional and for evaluation only.</div>
        </div>
      </footer>
    </div>
  );
}
