'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Loader2,
  Lock,
  Terminal,
  Network,
  MessageSquareCode,
  Copy,
  Check,
  Mail,
  Phone,
  Focus,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import CursorGrid from '@/frontend/src/components/CursorGrid';

/** Animated monochrome wireframe/dotted globe representing global AST node topology */
const WireframeGlobeSvg: React.FC = () => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-24 h-24 text-white animate-slow-spin"
    aria-hidden="true"
  >
    <circle cx="60" cy="60" r="46" stroke="currentColor" strokeWidth="1" strokeOpacity="0.85" />
    <ellipse cx="60" cy="60" rx="28" ry="46" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.55" />
    <ellipse cx="60" cy="60" rx="12" ry="46" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.35" />
    <ellipse cx="60" cy="60" rx="46" ry="20" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.5" />
    <ellipse cx="60" cy="60" rx="46" ry="36" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.3" strokeDasharray="2 3" />
    <line x1="14" y1="60" x2="106" y2="60" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    <line x1="60" y1="14" x2="60" y2="106" stroke="currentColor" strokeWidth="0.8" strokeOpacity="0.4" />
    <circle cx="60" cy="14" r="2.2" fill="currentColor" />
    <circle cx="88" cy="40" r="2.2" fill="currentColor" />
    <circle cx="32" cy="46" r="2" fill="currentColor" fillOpacity="0.8" />
    <circle cx="74" cy="78" r="2.2" fill="currentColor" />
    <circle cx="44" cy="84" r="1.8" fill="currentColor" fillOpacity="0.7" />
    <circle cx="60" cy="60" r="2.5" fill="currentColor" />
  </svg>
);

/** Crisp 8-spoke architectural asterisk wireframe icon */
const AsteriskIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={className} aria-hidden="true">
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
  </svg>
);

export default function LandingPage() {
  const router = useRouter();
  const { user, signInWithGithub, authLoading } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleGitHubSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInWithGithub();
      router.push('/dashboard');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setAuthError(err?.message || 'Could not complete GitHub sign-in.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('contact.repolens@gmail.com');
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    }
  };

  const isBusy = signingIn || authLoading;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] relative font-sans selection:bg-white selection:text-[#09090B] overflow-x-hidden">
      {/* Interactive WebGL2 CursorGrid Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <CursorGrid
          cellSize={54}
          color="#ffffff"
          gridColor="#ffffff"
          gridStyle="lines"
          radius={140}
          spotlight={0.6}
          gridOpacity={0.07}
          maxOpacity={0.55}
          fillOpacity={0.05}
          clickPulse
        />
      </div>

      {/* Foreground Content Layer */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* 1. Top Navigation Bar (Full-Width Hairline Frame) */}
        <header className="w-full border-b border-[#27272A] bg-[#09090B]/85 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            {/* Left: Company Logo + RepoLens Wordmark */}
            <Link href="/" className="flex items-center space-x-2.5 group shrink-0">
              <div className="h-7 w-7 flex items-center justify-center rounded-lg bg-white p-0.5 shrink-0">
                {!logoError ? (
                  <img
                    src="/logo.png"
                    alt="RepoLens Logo"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (target.src.endsWith('/logo.png')) {
                        target.src = '/logo.svg';
                      } else {
                        setLogoError(true);
                      }
                    }}
                    className="h-6 w-6 object-contain"
                  />
                ) : (
                  <span className="text-[11px] font-bold text-[#09090B] font-mono">RL</span>
                )}
              </div>
              <span className="font-semibold text-[#FAFAFA] text-[15px] tracking-[-0.02em]">
                RepoLens
              </span>
            </Link>

            {/* Center Navigation Links (Smooth Scroll Anchors) */}
            <nav className="hidden md:flex items-center space-x-7 text-xs text-[#A1A1AA]">
              <a href="#architecture" className="hover:text-white transition-colors">
                Architecture
              </a>
              <a href="#privacy-ast" className="hover:text-white transition-colors">
                Privacy AST
              </a>
              <a href="#contact" className="hover:text-white transition-colors">
                Team
              </a>
              <Link href="/feedback" className="hover:text-white transition-colors">
                Feedback
              </Link>
              <a
                href="https://github.com/mahir08107/RepoLens"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors inline-flex items-center gap-1"
              >
                <span>GitHub</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </nav>

            {/* Right Action Pill(s) */}
            <div className="flex items-center gap-2.5 shrink-0">
              {user ? (
                <>
                  <div className="hidden sm:inline-flex h-9 px-3.5 items-center gap-2 rounded-full border border-[#3F3F46] bg-[#18181B] text-xs font-medium text-[#FAFAFA]">
                    {user.photoURL && (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || 'GitHub Avatar'}
                        className="h-5 w-5 rounded-full object-cover border border-[#3F3F46]"
                      />
                    )}
                    <span className="font-mono">
                      @{user.username || user.displayName?.split(' ')[0] || 'user'}
                    </span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full bg-white hover:bg-[#E4E4E7] text-[#09090B] text-xs font-medium transition-colors"
                  >
                    <span>Open Workspace</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleGitHubSignIn}
                  disabled={isBusy}
                  className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full border border-[#3F3F46] hover:border-white bg-[#09090B]/70 text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-60"
                >
                  {signingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Sign in with GitHub</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12">
          {authError && (
            <div className="mb-4 px-4 py-2.5 rounded-xl bg-[#18181B] border border-[#3F3F46] text-xs text-red-400">
              {authError}
            </div>
          )}

          {/* ================================================================
              HERO SECTION: Asymmetric Interlocking Bento Grid
             ================================================================ */}
          <section id="bento-grid" className="grid grid-cols-12 gap-4 auto-rows-min">
            {/* TILE 1: Main Left-Top White Hero Card */}
            <div className="col-span-12 lg:col-span-8 bg-[#FFFFFF] text-[#09090B] rounded-[24px] sm:rounded-[28px] p-6 sm:p-10 lg:p-14 flex flex-col justify-between lg:min-h-[340px] relative overflow-hidden">
              <div className="flex items-start justify-between gap-6">
                <div className="max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#E4E4E7] bg-[#FAFAFA] text-[11px] font-mono text-[#52525B] mb-5 sm:mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                    <span>ZERO-TRUST BROWSER AST ENGINE</span>
                  </div>
                  <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-medium leading-[1.06] tracking-[-0.035em] text-[#09090B]">
                    Codebases that clarify.
                    <br />
                    Architecture that scales.
                  </h1>
                </div>

                {/* Right-aligned Inset Dark Cutout Square with Wireframe Globe */}
                <div className="hidden sm:flex w-36 h-36 bg-[#09090B] rounded-[24px] shrink-0 items-center justify-center shadow-sm">
                  <WireframeGlobeSvg />
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[#E4E4E7] flex flex-wrap items-center justify-between gap-3 text-xs text-[#71717A] font-mono">
                <span>LOCAL WEB WORKER • 0 BYTES RAW CODE UPLOADED</span>
                <Link
                  href="/dashboard?repo=https://github.com/expressjs/express"
                  className="inline-flex items-center gap-1 text-[#09090B] font-medium hover:underline"
                >
                  <span>Try expressjs/express</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* TILE 2: Top-Right Black Feature Callout (Intelligence) */}
            <div className="col-span-12 sm:col-span-6 lg:col-span-2 bg-[#09090B]/90 backdrop-blur-xs border border-[#27272A] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <span className="text-white/80 text-lg font-light leading-none select-none">+</span>
                <span className="font-mono text-[11px] uppercase tracking-widest text-[#A1A1AA]">
                  01 / ENGINE
                </span>
              </div>

              <div className="mt-auto pt-8">
                <h2 className="font-sans text-xl font-medium tracking-[-0.02em] leading-snug text-white">
                  Intelligence
                </h2>
                <p className="font-sans text-[13px] leading-relaxed text-[#A1A1AA] mt-1.5">
                  Local Tree-sitter AST parsing paired with Gemini synthesis to map modules into clean architectural layers.
                </p>
                <div className="mt-4 pt-3 border-t border-[#27272A] flex items-center justify-between font-mono text-[11px] text-[#71717A]">
                  <span>PARSER</span>
                  <span className="text-[#E4E4E7]">WASM Local</span>
                </div>
              </div>
            </div>

            {/* TILE 3: Top-Right White Primary Action Card (Open Studio) */}
            <Link
              href="/dashboard"
              className="col-span-12 sm:col-span-6 lg:col-span-2 bg-[#FFFFFF] hover:bg-[#F4F4F5] text-[#09090B] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between group transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-widest text-[#71717A]">
                  02 / WORKSPACE
                </span>
                <span className="bg-[#F4F4F5] text-[#09090B] font-mono text-[10px] px-2.5 py-0.5 rounded-full shrink-0">
                  LIVE
                </span>
              </div>

              <div className="mt-auto pt-8">
                <p className="font-sans text-xs text-[#52525B] leading-relaxed mb-3">
                  Paste any public or private GitHub URL to generate an interactive dependency graph.
                </p>
                <div className="flex items-end justify-between gap-2">
                  <span className="font-sans text-2xl font-medium tracking-[-0.025em] leading-tight text-[#09090B]">
                    Open Studio
                  </span>
                  <ArrowUpRight className="w-6 h-6 text-[#09090B] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </Link>

            {/* TILE 4: Bottom-Left Obsidian Intro & CTA Block */}
            <div className="col-span-12 lg:col-span-4 bg-[#09090B]/90 backdrop-blur-xs border border-[#27272A] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between">
              <p className="font-sans text-[13px] text-[#D4D4D8] leading-relaxed max-w-xs">
                We parse your repository structure locally in the browser—never transmitting raw business logic—to map dependencies, zones, and blast radius.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white pb-1 border-b border-white hover:opacity-80 transition-opacity"
                >
                  <span>Try for free</span>
                  <ArrowUpRight className="w-4 h-4" />
                </Link>

                <button
                  type="button"
                  onClick={handleGitHubSignIn}
                  disabled={isBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[#A1A1AA] hover:text-white pb-1 border-b border-transparent hover:border-[#3F3F46] transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign in with GitHub</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* TILE 5: Center Pair — 03 / ISOLATION (White) + 04 / TOPOLOGY (Dark) */}
            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#FFFFFF] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between text-[#09090B]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#71717A]">
                    03 / ISOLATION
                  </span>
                  <Focus className="w-4 h-4 text-[#09090B] shrink-0" />
                </div>
                <div className="mt-auto pt-6">
                  <h3 className="font-sans text-xl font-medium tracking-[-0.02em] leading-snug text-[#09090B]">
                    1-Hop Blast Radius
                  </h3>
                  <p className="font-sans text-[13px] leading-relaxed text-[#52525B] mt-1.5">
                    Select any file to isolate its direct callers and downstream imports.
                  </p>
                </div>
              </div>

              <div className="bg-[#09090B]/90 backdrop-blur-xs border border-[#27272A] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white/80 text-lg font-light leading-none">+</span>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#A1A1AA]">
                    04 / TOPOLOGY
                  </span>
                </div>
                <div className="mt-auto pt-6">
                  <h3 className="font-sans text-xl font-medium tracking-[-0.02em] leading-snug text-white">
                    Connection
                  </h3>
                  <p className="font-sans text-[13px] leading-relaxed text-[#A1A1AA] mt-1.5">
                    Tracing cross-folder imports, exports, and zone boundaries across every module.
                  </p>
                </div>
              </div>
            </div>

            {/* TILE 6: Bottom-Right Pair — 05 / SECURITY (Dark) + 06 / AUDIT (White) */}
            <div className="col-span-12 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#09090B]/90 backdrop-blur-xs border border-[#27272A] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2">
                  <AsteriskIcon className="w-5 h-5 text-white/80 shrink-0" />
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#A1A1AA]">
                    05 / SECURITY
                  </span>
                </div>
                <div className="mt-auto pt-6">
                  <h3 className="font-sans text-xl font-medium tracking-[-0.02em] leading-snug text-white">
                    Impact
                  </h3>
                  <p className="font-sans text-[13px] leading-relaxed text-[#A1A1AA] mt-1.5">
                    Zero-trust privacy verified before a single byte leaves your browser.
                  </p>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="bg-[#FFFFFF] hover:bg-[#F4F4F5] text-[#09090B] rounded-[24px] sm:rounded-[28px] p-6 sm:p-7 flex flex-col justify-between group transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-[#71717A]">
                    06 / AUDIT
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0" />
                </div>
                <div className="mt-auto pt-6">
                  <p className="font-sans text-[13px] leading-relaxed text-[#52525B] mb-3">
                    Verify zero function bodies leave your machine.
                  </p>
                  <div className="flex items-end justify-between gap-2">
                    <span className="font-sans text-xl font-medium tracking-[-0.02em] leading-snug text-[#09090B]">
                      Inspect Payload
                    </span>
                    <ArrowUpRight className="w-5 h-5 text-[#09090B] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </Link>
            </div>
          </section>

          {/* ================================================================
              SECTION 1: #architecture — "How RepoLens Works" (3-Step Pipeline)
             ================================================================ */}
          <section id="architecture" className="mt-24 scroll-mt-24">
            <div className="max-w-2xl">
              <div className="text-xs font-mono tracking-widest text-[#A1A1AA] uppercase">
                01 / SYSTEM ARCHITECTURE
              </div>
              <h2 className="text-3xl sm:text-4xl font-medium tracking-[-0.03em] text-white mt-3 leading-tight">
                From raw repository to interactive architecture map in three steps.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {/* STEP 01 */}
              <div className="bg-[#18181B]/95 backdrop-blur-xs border border-[#27272A] rounded-[28px] p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#09090B] border border-[#27272A] font-mono text-[11px] text-[#E4E4E7]">
                      STEP 01
                    </span>
                    <Terminal className="w-5 h-5 text-[#A1A1AA]" />
                  </div>
                  <h3 className="text-white text-xl font-medium tracking-[-0.02em] mt-6">
                    Client-Side AST Extraction
                  </h3>
                  <p className="text-[#A1A1AA] text-sm leading-relaxed mt-3">
                    When you enter a public or private GitHub URL, RepoLens fetches files directly in your browser and runs Tree-sitter inside an isolated Web Worker—extracting only imports, exports, and function signatures.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#27272A] font-mono text-[11px] text-[#E4E4E7] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  <span>0 BYTES OF FUNCTION BODIES SENT</span>
                </div>
              </div>

              {/* STEP 02 (Inverted White Center Card) */}
              <div className="bg-[#FFFFFF] text-[#09090B] border border-[#E4E4E7] rounded-[28px] p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#F4F4F5] border border-[#E4E4E7] font-mono text-[11px] text-[#09090B]">
                      STEP 02
                    </span>
                    <Network className="w-5 h-5 text-[#09090B]" />
                  </div>
                  <h3 className="text-[#09090B] text-xl font-medium tracking-[-0.02em] mt-6">
                    Semantic Zone &amp; Dependency Synthesis
                  </h3>
                  <p className="text-[#52525B] text-sm leading-relaxed mt-3">
                    Sanitized structural skeletons are classified into logical architectural layers—UI, API routes, core services, and shared contracts—and cached by commit SHA for instant replay.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#E4E4E7] font-mono text-[11px] text-[#09090B] font-medium">
                  GEMINI AI + COMMIT-SHA CACHE
                </div>
              </div>

              {/* STEP 03 */}
              <div className="bg-[#18181B]/95 backdrop-blur-xs border border-[#27272A] rounded-[28px] p-8 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-[#09090B] border border-[#27272A] font-mono text-[11px] text-[#E4E4E7]">
                      STEP 03
                    </span>
                    <MessageSquareCode className="w-5 h-5 text-[#A1A1AA]" />
                  </div>
                  <h3 className="text-white text-xl font-medium tracking-[-0.02em] mt-6">
                    Blast-Radius &amp; Copilot Exploration
                  </h3>
                  <p className="text-[#A1A1AA] text-sm leading-relaxed mt-3">
                    Click any module to trace 1-hop incoming dependents and outgoing imports, filter by architectural zone, or ask the context-aware AI Copilot what breaks before you refactor.
                  </p>
                </div>
                <div className="mt-8 pt-4 border-t border-[#27272A] font-mono text-[11px] text-[#E4E4E7]">
                  INTERACTIVE GRAPH + ⌘I COPILOT
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              SECTION 2: #privacy-ast — "Zero-Trust Privacy & What RepoLens Solves"
             ================================================================ */}
          <section id="privacy-ast" className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-20 scroll-mt-24">
            {/* Left White Showcase Card */}
            <div className="lg:col-span-7 bg-[#FFFFFF] text-[#09090B] border border-[#E4E4E7] rounded-[28px] p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono text-[#71717A] tracking-wider uppercase">
                  02 / ZERO-TRUST PRIVACY ARCHITECTURE
                </div>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-[#09090B] mt-3 leading-tight">
                  Built for proprietary codebases you can&apos;t paste into public AI tools.
                </h2>
                <p className="text-[#52525B] text-sm leading-relaxed mt-3">
                  Traditional AI code tools upload your entire repository to third-party servers. RepoLens strips every implementation body locally before a single network request leaves your tab—and keeps your GitHub OAuth token strictly in browser memory.
                </p>
              </div>

              {/* Mini Live Code Comparison Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                <div className="bg-[#F4F4F5] border border-[#E4E4E7] rounded-2xl p-4 font-mono text-xs">
                  <div className="text-[11px] font-semibold text-[#71717A] mb-2.5">
                    ❌ Raw Source (Never Leaves Browser)
                  </div>
                  <pre className="text-[11px] text-[#71717A] line-through decoration-[#A1A1AA] overflow-x-auto leading-relaxed">
{`export async function verifySession(tok) {
  const secret = db.query(
    "SELECT key FROM vault WHERE id=$1"
  );
  return hmac(tok, secret);
}`}
                  </pre>
                </div>

                <div className="bg-[#09090B] text-white border border-[#27272A] rounded-2xl p-4 font-mono text-xs">
                  <div className="text-[11px] font-semibold text-[#4ADE80] mb-2.5">
                    ✓ AST Skeleton (Sent to AI)
                  </div>
                  <pre className="text-[11px] text-[#E4E4E7] overflow-x-auto leading-relaxed">
{`{
  filePath: "auth.ts",
  exports: ["verifySession"],
  imports: ["./db"],
  signatures: ["verifySession(tok)"]
}`}
                  </pre>
                </div>
              </div>
            </div>

            {/* Right Dark Feature Stack (Tightened spacing + Architectural Proof Strips) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="flex-1 bg-[#18181B]/90 backdrop-blur-xs border border-[#27272A] rounded-[28px] p-6 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#A1A1AA] uppercase tracking-wider">
                    GITHUB OAUTH
                  </span>
                  <Lock className="w-4 h-4 text-[#A1A1AA]" />
                </div>

                <div>
                  <h3 className="text-white text-lg font-medium tracking-[-0.02em]">
                    Private Repo Support
                  </h3>
                  <p className="text-[#A1A1AA] text-xs leading-relaxed mt-1.5">
                    Sign in with GitHub OAuth to browse and map private repositories in one click, with 5,000 req/hr API limits.
                  </p>
                </div>

                <div className="pt-3 border-t border-[#27272A] flex items-center justify-between font-mono text-[11px]">
                  <span className="text-[#71717A]">TOKEN STORAGE</span>
                  <span className="text-[#E4E4E7]">Browser Memory Only</span>
                </div>
              </div>

              <div className="flex-1 bg-[#18181B]/90 backdrop-blur-xs border border-[#27272A] rounded-[28px] p-6 flex flex-col justify-between gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#A1A1AA] uppercase tracking-wider">
                    ONBOARDING VELOCITY
                  </span>
                  <AsteriskIcon className="w-4 h-4 text-[#A1A1AA]" />
                </div>

                <div>
                  <h3 className="text-white text-lg font-medium tracking-[-0.02em]">
                    Why RepoLens Exists
                  </h3>
                  <p className="text-[#A1A1AA] text-xs leading-relaxed mt-1.5">
                    Onboarding onto a 50+ file repository shouldn&apos;t take three days of grep. RepoLens turns unfamiliar folders into an interactive architectural blueprint in seconds.
                  </p>
                </div>

                <div className="pt-3 border-t border-[#27272A] flex items-center justify-between font-mono text-[11px]">
                  <span className="text-[#71717A]">TIME TO CLARITY</span>
                  <span className="text-[#E4E4E7]">~4s vs 3 Days Grep</span>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================================
              SECTION 3: #contact — "About RepoLens, Team DevMap & Contact Bento"
             ================================================================ */}
          <section id="contact" className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-20 pb-14 scroll-mt-24">
            {/* Left White Editorial & Contact Card */}
            <div className="lg:col-span-7 bg-[#FFFFFF] text-[#09090B] border border-[#E4E4E7] rounded-[28px] p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="font-mono text-xs uppercase tracking-widest text-[#71717A]">
                  03 / ABOUT REPOLENS • BUILT BY TEAM DEVMAP
                </div>
                <h2 className="text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-[#09090B] mt-3 leading-tight">
                  Engineered to make complex codebases effortless to navigate—without compromising source-code privacy.
                </h2>
                <p className="text-sm text-[#52525B] leading-relaxed mt-3 max-w-xl">
                  RepoLens was created by Team DevMap to eliminate the hours developers spend manually tracing imports across unfamiliar repositories. By combining local browser-side AST parsing with interactive dependency mapping and context-aware AI, we give engineering teams instant architectural clarity.
                </p>
              </div>

              {/* Direct Contact Pills */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-1.5 bg-[#09090B] text-white hover:bg-[#27272A] rounded-full px-5 py-2.5 text-xs font-medium transition-colors"
                >
                  <span>Launch RepoLens Studio</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>

                <Link
                  href="/feedback"
                  className="inline-flex items-center gap-1.5 border border-[#09090B] text-[#09090B] hover:bg-[#09090B] hover:text-white rounded-full px-4 py-2 text-xs font-medium transition-colors"
                >
                  <span>Report Issue / Feedback</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>

                <div className="inline-flex items-center border border-[#D4D4D8] hover:border-[#09090B] rounded-full text-[#09090B] text-xs font-mono transition-colors overflow-hidden">
                  <a
                    href="mailto:contact.repolens@gmail.com"
                    className="inline-flex items-center gap-1.5 pl-4 pr-2.5 py-2 hover:bg-[#F4F4F5] transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#71717A]" />
                    <span>contact.repolens@gmail.com</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    title="Copy email address"
                    className="pl-2 pr-3 py-2 border-l border-[#E4E4E7] hover:bg-[#F4F4F5] text-[#71717A] hover:text-[#09090B] transition-colors cursor-pointer"
                  >
                    {emailCopied ? (
                      <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <a
                  href="tel:+919319231536"
                  className="inline-flex items-center gap-1.5 border border-[#D4D4D8] hover:border-[#09090B] text-[#09090B] rounded-full px-4 py-2 text-xs font-mono transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#71717A]" />
                  <span>+91 9319231536</span>
                </a>

                <a
                  href="https://instagram.com/repo.lens"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 border border-[#D4D4D8] hover:border-[#09090B] text-[#09090B] rounded-full px-4 py-2 text-xs font-mono transition-colors"
                >
                  <span>@repo.lens</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right Dark Founding Team Card */}
            <div className="lg:col-span-5 bg-[#18181B]/90 backdrop-blur-sm border border-[#27272A] rounded-[28px] p-8 flex flex-col justify-between">
              <div>
                <div className="font-mono text-[11px] tracking-widest text-[#A1A1AA] uppercase">
                  FOUNDING TEAM
                </div>
                <h3 className="text-white text-xl font-medium mt-1 tracking-[-0.02em]">
                  Built by Team DevMap
                </h3>

                {/* Co-Founders Roster (Stacks cleanly on narrow mobile screens) */}
                <div className="mt-6 divide-y divide-[#27272A]">
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                    <span className="text-white font-medium text-sm shrink-0">Mahir</span>
                    <span className="font-mono text-[11px] text-[#A1A1AA] sm:text-right">
                      Chief Executive Officer &amp; Co-Founder
                    </span>
                  </div>
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                    <span className="text-white font-medium text-sm shrink-0">Nabhye Tripathy</span>
                    <span className="font-mono text-[11px] text-[#A1A1AA] sm:text-right">
                      Chief Technology Officer &amp; Co-Founder
                    </span>
                  </div>
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                    <span className="text-white font-medium text-sm shrink-0">Kinjal Rajpurohit</span>
                    <span className="font-mono text-[11px] text-[#A1A1AA] sm:text-right">
                      Chief Product Officer &amp; Co-Founder
                    </span>
                  </div>
                  <div className="py-3.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4">
                    <span className="text-white font-medium text-sm shrink-0">Anvesha Misra</span>
                    <span className="font-mono text-[11px] text-[#A1A1AA] sm:text-right">
                      Chief Design Officer &amp; Co-Founder
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#27272A] flex items-center justify-between text-[11px] font-mono text-[#71717A]">
                <span>© 2026 RepoLens • Team DevMap</span>
                <span>ZERO-TRUST AST</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
