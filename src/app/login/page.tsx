"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, Building2, ClipboardCheck, Eye, EyeOff, LandPlot, Loader2, Lock, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiSend } from "@/lib/api-client";

const demos = [
  { role: "citizen", label: "Citizen", email: "citizen@bhumidemo.in", description: "View property, documents and status", icon: UserRound, tone: "border-blue-200 bg-blue-50 hover:border-blue-300" },
  { role: "surveyor", label: "Surveyor", email: "surveyor@bhumidemo.in", description: "Upload evidence and run validation", icon: LandPlot, tone: "border-emerald-200 bg-emerald-50 hover:border-emerald-300" },
  { role: "officer", label: "Revenue Officer", email: "officer@bhumidemo.in", description: "Review, approve or request correction", icon: BadgeCheck, tone: "border-amber-200 bg-amber-50 hover:border-amber-300" },
  { role: "admin", label: "Administrator", email: "admin@bhumidemo.in", description: "Users, weights, thresholds and reset", icon: ShieldCheck, tone: "border-violet-200 bg-violet-50 hover:border-violet-300" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("officer@bhumidemo.in");
  const [password, setPassword] = useState("demo123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(nextEmail = email, nextPassword = password) {
    setLoading(true);
    setError(null);
    try {
      await apiSend("/api/auth/login", "POST", { email: nextEmail, password: nextPassword });
      toast.success("Signed in", { description: "Welcome to the BHŪMI 3D demonstration workspace." });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] lg:grid lg:grid-cols-[1.02fr_0.98fr]">
      <div className="brand-gradient relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="hero-grid absolute inset-0 opacity-60" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-900/40">
              <LandPlot className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-wide">BHŪMI <span className="text-emerald-400">3D</span></div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-200/70">Digitize · Validate · Trust</div>
            </div>
          </Link>
        </div>
        <div className="relative max-w-lg">
          <Badge className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">Smart India Hackathon 2026</Badge>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight">
            Enter a land record.<br />Leave with evidence you can question.
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            The demo workspace connects documents, cadastral geometry, ground evidence, validation,
            the Parcel Trust Score, officer review and the 3D/4D property passport.
          </p>
          <div className="mt-8 space-y-3">
            {[
              ["Upload the sample 7/12", "OCR extraction with confidence and correction."],
              ["Validate parcel 118/2", "Area mismatch, land-use conflict and boundary shift."],
              ["Explain the 82/100 score", "Four components, deductions and missing evidence."],
              ["Review as an officer", "Decision, receipt, SHA-256 seal and audit trail."],
            ].map(([title, text], i) => (
              <div key={title} className="flex gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-emerald-500/20 text-[10px] font-bold text-emerald-300">0{i + 1}</div>
                <div>
                  <div className="text-xs font-semibold text-white">{title}</div>
                  <div className="text-[11px] text-slate-400">{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-[10px] text-slate-500">
          <Building2 className="h-3.5 w-3.5" /> Ministry of Rural Development · Department of Land Resources
        </div>
      </div>

      <div className="flex min-h-screen flex-col justify-center px-4 py-12 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#14532d] text-white"><LandPlot className="h-4 w-4" /></div>
              <div className="text-sm font-bold">BHŪMI <span className="text-emerald-600">3D</span></div>
            </Link>
            <Link href="/" className="text-xs text-slate-500 hover:text-emerald-700">Back to overview</Link>
          </div>

          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Secure demo access</div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Sign in to the workspace</h2>
          <p className="mt-1.5 text-sm text-slate-500">Use a demo account or choose a role below for a one-click login.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              signIn();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bhumidemo.in" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            <Button type="submit" disabled={loading} className="h-11 w-full bg-[#14532d] text-white hover:bg-[#166534]">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Or enter as</span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            {demos.map((demo) => (
              <button
                key={demo.role}
                type="button"
                disabled={loading}
                onClick={() => {
                  setEmail(demo.email);
                  setPassword("demo123");
                  signIn(demo.email, "demo123");
                }}
                className={`group rounded-xl border p-3 text-left transition disabled:opacity-60 ${demo.tone}`}
              >
                <div className="flex items-center justify-between">
                  <demo.icon className="h-4 w-4 text-slate-700" />
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition group-hover:translate-x-0.5" />
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-900">{demo.label}</div>
                <div className="mt-0.5 text-[10px] leading-4 text-slate-600">{demo.description}</div>
                <div className="mt-1.5 font-mono text-[9px] text-slate-500">{demo.email}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Lock className="h-3 w-3" /> Password for every demo account: <span className="font-mono font-semibold text-slate-700">demo123</span>
          </div>

          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-3 text-[10px] leading-4 text-slate-500">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700"><ClipboardCheck className="h-3 w-3 text-emerald-600" /> Prototype notice</div>
            <p className="mt-1">All records, names, identifiers, geometries and scores are illustrative. This is not a government service and no action here creates a legal certificate.</p>
          </div>
          <Link href="/" className="mt-4 inline-block text-xs text-slate-500 hover:text-emerald-700">← Back to public overview</Link>
        </div>
      </div>
    </div>
  );
}
