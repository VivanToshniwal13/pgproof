import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import {
  Camera,
  ClipboardList,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  Play,
  Lock,
} from "lucide-react";
import { auth, googleProvider, getFriendlyErrorMessage } from "../lib/firebase";
import { ensureUserProfile } from "../lib/firestoreStore";
import { HERO_PG_IMAGE } from "../data/demoData";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface LandingAuthScreenProps {
  onStartDemo: () => void;
  onAuthComplete: () => void;
}

export function LandingAuthScreen({ onStartDemo, onAuthComplete }: LandingAuthScreenProps) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const scrollToAuth = () => {
    document.getElementById("auth-panel")?.scrollIntoView({ behavior: "smooth" });
  };

  async function handleGoogleAuth() {
    setError(null);
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(cred.user.uid, {
        name: cred.user.displayName || "Tenant",
        phone: cred.user.phoneNumber || "",
        city: "Bengaluru",
      });
      onAuthComplete();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (mode === "signup") {
      if (name.trim().length < 2) {
        setError("Please enter your full name (at least 2 characters).");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await ensureUserProfile(cred.user.uid, {
          name: name.trim(),
          phone: phone.trim(),
          city: city.trim() || "Bengaluru",
        });
      } else {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        await ensureUserProfile(cred.user.uid, {
          name: cred.user.displayName || email.split("@")[0] || "Tenant",
          phone: "",
          city: "Bengaluru",
        });
      }
      onAuthComplete();
    } catch (err) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-indigo-950 whitespace-nowrap shrink-0"
          >
            PGProof
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#how-it-works"
              className="hover:text-indigo-950 transition-colors whitespace-nowrap shrink-0"
            >
              How it works
            </a>
            <a
              href="#bengaluru"
              className="hover:text-indigo-950 transition-colors whitespace-nowrap shrink-0"
            >
              Bengaluru PGs
            </a>
            <a
              href="#auth-panel"
              className="hover:text-indigo-950 transition-colors whitespace-nowrap shrink-0"
            >
              Sign in
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <Button size="sm" onClick={scrollToAuth}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-14 sm:px-6 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-sm font-medium text-amber-700">
                Built for Bengaluru PG tenants · Koramangala · HSR · Indiranagar · BTM
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl text-balance leading-[1.12]">
                Your PG deposit, protected by proof.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                Stop losing ₹5,000 to ₹15,000 of your security deposit to vague repainting or repair
                claims. Lock timestamped move-in photos, log unfixed hostel issues, and turn real
                evidence into calm, firm refund notices.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={scrollToAuth}>
                  Protect my deposit
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={onStartDemo}>
                  <Play className="h-4 w-4 text-amber-600" />
                  Try demo
                </Button>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                <span>Timestamped move-in records</span>
                <span aria-hidden="true">·</span>
                <span>AI deduction audit</span>
                <span aria-hidden="true">·</span>
                <span>WhatsApp &amp; PDF notices</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
                {!imgFailed ? (
                  <img
                    src={HERO_PG_IMAGE}
                    alt="Sunlit student paying-guest room in Koramangala, Bengaluru"
                    referrerPolicy="no-referrer"
                    onError={() => setImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-900 p-8 text-center text-white">
                    <ShieldCheck className="h-12 w-12 text-amber-400" />
                    <p className="mt-3 font-display text-lg font-semibold">
                      Timestamped Room Evidence
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Lock move-in photos before unpacking.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Explainer */}
        <section id="how-it-works" className="border-y border-slate-200 bg-white py-14 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Three steps from check-in day to full refund
              </h2>
              <p className="mt-2 text-base text-slate-600">
                No legal jargon, no clutter. Just dated evidence you control.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-indigo-900">01.</span>
                  <Camera className="h-5 w-5 text-indigo-900" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-950">
                  Scan at move-in
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Snap photos of the bed, wall, bathroom, wardrobe, and floor. AI spots pre-existing
                  stains or loose hinges, then you lock the record with a server timestamp.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-indigo-900">02.</span>
                  <ClipboardList className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-950">
                  Log problems
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Track Wi-Fi outages, water cuts, hygiene lapses, or food issues as they happen.
                  Each open issue tracks a live counter of how many days it went unfixed.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-indigo-900">03.</span>
                  <ShieldCheck className="h-5 w-5 text-emerald-700" />
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold text-slate-950">
                  Claim your deposit
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Enter any deductions claimed at move-out. AI matches them side-by-side against
                  your locked move-in photos and drafts calm WhatsApp, formal, and grievance texts.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bengaluru Grounding + Auth Section */}
        <section id="bengaluru" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:py-20">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl text-balance">
                Why Bengaluru PG residents lose deposit money — and how dated proof stops it
              </h2>
              <p className="mt-4 text-base leading-relaxed text-slate-600">
                Most PG hostels collect ₹15,000 to ₹30,000 upfront with informal receipts. At
                move-out, tenants are often charged for wall dampness, loose wardrobe hinges, or
                hard-water bathroom scaling that existed before they moved in.
              </p>

              <div className="mt-8 space-y-5 border-t border-slate-200 pt-6">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-indigo-900" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Read-only locked move-in records
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Once you click Lock, database security rules block updates or deletions on
                      your check-in photos.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Try before creating an account
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Explore Riya’s Room 204 record at Sunrise PG, Koramangala with ₹20,000
                      deposit and an unfair ₹4,500 wall charge caught automatically.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button variant="outline" onClick={onStartDemo}>
                  <Play className="h-4 w-4 text-amber-600" />
                  Open interactive demo
                </Button>
              </div>
            </div>

            {/* Auth Card */}
            <div id="auth-panel" className="lg:col-span-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>
                        {mode === "signup" ? "Create your PGProof account" : "Welcome back"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {mode === "signup"
                          ? "Save your PG details, photos, and notices securely."
                          : "Log in to access your PG proof folder."}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                      }}
                      className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        mode === "signup"
                          ? "bg-white text-indigo-950 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Sign up
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError(null);
                      }}
                      className={`min-h-[40px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                        mode === "login"
                          ? "bg-white text-indigo-950 shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Log in
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={googleLoading || loading}
                    onClick={handleGoogleAuth}
                  >
                    {googleLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                        />
                      </svg>
                    )}
                    Continue with Google
                  </Button>

                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2.5 text-slate-500">or with email</span>
                    </div>
                  </div>

                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {mode === "signup" && (
                      <>
                        <div className="space-y-1.5">
                          <Label htmlFor="auth-name">Full name</Label>
                          <Input
                            id="auth-name"
                            placeholder="e.g. Ananya Rao"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <Label htmlFor="auth-phone">Phone (optional)</Label>
                            <Input
                              id="auth-phone"
                              type="tel"
                              placeholder="+91 98450 00000"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="auth-city">City</Label>
                            <Input
                              id="auth-city"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-1.5">
                      <Label htmlFor="auth-email">Email</Label>
                      <Input
                        id="auth-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="auth-password">Password</Label>
                      <Input
                        id="auth-password"
                        type="password"
                        placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading || googleLoading}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                      {mode === "signup" ? "Create account & continue" : "Log in"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <span>PGProof · Built for PG hostel tenants in Bengaluru</span>
          <span>Communication &amp; evidence documentation tool, not legal advice.</span>
        </div>
      </footer>
    </div>
  );
}
