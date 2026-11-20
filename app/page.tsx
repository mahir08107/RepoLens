'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Lock,
  GitFork,
  MessageSquareCode,
  ShieldCheck,
  Cpu,
  Network,
  Loader2,
  CheckCircle2,
  FileCode2,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

const GitHubOctocatIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
  </svg>
);

export default function LandingPage() {
  const router = useRouter();
  const { user, signInWithGithub, authLoading } = useAuth();
  const [logoError, setLogoError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const isBusy = signingIn || authLoading;

  return (
    <div className="min-h-screen bg-[#ffffff] text-[#1f2328] flex flex-col font-sans">
      {/* 1. Top Navigation Bar */}
      <header className="h-[60px] bg-[#f6f8fa] border-b border-[#d0d7de] sticky top-0 z-30">
        <div className="max-w-6xl h-full mx-auto px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <div className="flex items-center justify-center h-7 w-7 shrink-0">
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
                  className="h-7 w-7 object-contain rounded-md"
                />
              ) : (
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1f2328] text-white font-bold text-xs">
                  RL
                </div>
              )}
            </div>
            <span className="font-semibold text-[#1f2328] text-[15px] tracking-tight">
              RepoLens
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ddf4ff] text-[#0969da] border border-[#54aeff]/40 tracking-tight">
              PRIVACY-FIRST AST
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            {user ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:inline-flex h-9 px-3 items-center gap-2 rounded-md border border-[#d0d7de] bg-[#ffffff] text-sm font-medium text-[#1f2328]">
                  {user.photoURL && (
                    <img
                      src={user.photoURL}
                      alt={user.displayName || 'User'}
                      className="h-5 w-5 rounded-full border border-[#d0d7de] object-cover"
                    />
                  )}
                  <span>
                    {user.username || user.displayName || 'Signed in'}
                  </span>
                </div>
                <Link
                  href="/dashboard"
                  className="h-9 px-4 inline-flex items-center gap-1.5 rounded-md bg-[#1f883d] hover:bg-[#1a7f37] text-sm font-medium text-white transition-colors"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGitHubSignIn}
                  disabled={isBusy}
                  className="h-8 px-3 rounded-md bg-[#24292f] hover:bg-[#1f2328] text-white text-xs font-medium inline-flex items-center space-x-1.5 border border-[#1b1f24] transition-colors cursor-pointer disabled:opacity-60"
                >
                  {signingIn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <GitHubOctocatIcon className="w-3.5 h-3.5" />
                  )}
                  <span>Sign in with GitHub</span>
                </button>
                <Link
                  href="/dashboard"
                  className="h-8 px-3 rounded-md bg-[#ffffff] hover:bg-[#f6f8fa] text-[#24292f] text-xs font-medium inline-flex items-center space-x-1 border border-[#d0d7de] transition-colors"
                >
                  <span>Open Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#656d76]" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <main className="flex-1">
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#f6f8fa] border border-[#d0d7de] text-xs text-[#656d76] mb-6">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1f883d]" />
              <span>Zero-Trust Client-Side AST Engine • Function bodies never leave your browser</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-[#1f2328] tracking-tight leading-[1.15] mb-5">
              Understand any codebase architecture in seconds — without exposing your source code.
            </h1>

            <p className="text-base sm:text-lg text-[#656d76] leading-relaxed mb-8 max-w-2xl mx-auto">
              RepoLens parses your repository&apos;s AST locally inside a browser Web Worker and sends only structural skeletons to Gemini to map dependencies, zones, and blast radius.
            </p>

            {/* Primary CTA Pair */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
              <button
                type="button"
                onClick={handleGitHubSignIn}
                disabled={isBusy}
                className="w-full sm:w-auto h-11 px-5 rounded-md bg-[#1f883d] hover:bg-[#1a7f37] active:bg-[#176f30] text-white text-sm font-semibold inline-flex items-center justify-center space-x-2 border border-[#1a7f37] shadow-xs transition-colors cursor-pointer disabled:opacity-60"
              >
                {signingIn ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <GitHubOctocatIcon className="w-4 h-4" />
                )}
                <span>Sign in with GitHub</span>
              </button>

              <Link
                href="/dashboard"
                className="w-full sm:w-auto h-11 px-5 rounded-md bg-[#f6f8fa] hover:bg-[#eaeef2] text-[#24292f] text-sm font-semibold inline-flex items-center justify-center space-x-2 border border-[#d0d7de] shadow-2xs transition-colors"
              >
                <span>Try for Free</span>
                <ArrowRight className="w-4 h-4 text-[#656d76]" />
              </Link>
            </div>

            <p className="text-xs text-[#656d76]">
              Sign in unlocks <span className="font-medium text-[#1f2328]">Private Repositories</span> &amp; 5,000 GitHub API req/hr. Guest mode supports public repos &amp; live demo.
            </p>

            {authError && (
              <div className="mt-4 max-w-md mx-auto px-3 py-2 rounded-md bg-[#ffebe9] border border-[#ff8182]/60 text-xs text-[#cf222e]">
                {authError}
              </div>
            )}
          </div>

          {/* Live Architecture Preview Card */}
          <div className="mt-12 max-w-4xl mx-auto bg-[#ffffff] border border-[#d0d7de] rounded-xl shadow-sm overflow-hidden">
            {/* GitHub-style Window Header */}
            <div className="px-4 py-2.5 bg-[#f6f8fa] border-b border-[#d0d7de] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2 text-xs text-[#656d76]">
                <span className="inline-flex items-center space-x-1 font-mono text-[#1f2328] font-medium">
                  <Lock className="w-3.5 h-3.5 text-[#1f883d]" />
                  <span>zero-trust-pipeline</span>
                </span>
                <span className="text-[#d0d7de]">•</span>
                <span>Client-side stripping verified</span>
              </div>

              <Link
                href="/dashboard?repo=https://github.com/expressjs/express"
                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#ddf4ff] hover:bg-[#cce8ff] text-[#0969da] border border-[#54aeff]/40 text-xs font-medium transition-colors"
              >
                <span>Try with</span>
                <code className="font-mono font-semibold">expressjs/express</code>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* 3-Step Pipeline Flow */}
            <div className="p-6 bg-[#f6f8fa]/50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {/* Step 1 */}
                <div className="bg-white border border-[#d0d7de] rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1f2328]">
                        <Cpu className="w-4 h-4 text-[#0969da]" />
                        <span>1. Browser Web Worker AST</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#f6f8fa] border border-[#d0d7de] text-[#656d76]">
                        Local Tab
                      </span>
                    </div>
                    <p className="text-xs text-[#656d76] leading-relaxed">
                      Fetches files directly from GitHub using your browser session. Strips all function bodies and secrets before any network call.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#eaeef2] flex items-center space-x-1.5 text-[11px] font-mono text-[#1f883d]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>0 bytes of raw logic uploaded</span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white border border-[#d0d7de] rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1f2328]">
                        <FileCode2 className="w-4 h-4 text-[#bf8700]" />
                        <span>2. Structural Skeleton Only</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#fff8c5] border border-[#d4a72c]/40 text-[#9a6700]">
                        AST JSON
                      </span>
                    </div>
                    <pre className="text-[11px] font-mono bg-[#f6f8fa] border border-[#d0d7de] rounded p-2 text-[#1f2328] overflow-x-auto leading-snug">
{`{
  filePath: "lib/router/index.js",
  imports: ["./route", "methods"],
  exports: ["proto.handle"]
}`}
                    </pre>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#eaeef2] text-[11px] text-[#656d76]">
                    Inspect exact outgoing payload anytime
                  </div>
                </div>

                {/* Step 3 */}
                <div className="bg-white border border-[#d0d7de] rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1f2328]">
                        <Network className="w-4 h-4 text-[#1f883d]" />
                        <span>3. Interactive Map &amp; Copilot</span>
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#ddf4ff] border border-[#54aeff]/40 text-[#0969da]">
                        Gemini AI
                      </span>
                    </div>
                    <p className="text-xs text-[#656d76] leading-relaxed">
                      Visualizes architectural zones, directional imports, blast radius, and provides a node-scoped Copilot drawer.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#eaeef2] flex items-center justify-between text-[11px]">
                    <span className="text-[#656d76]">Exportable Vector SVG</span>
                    <span className="font-mono text-[#0969da]">⌘I Copilot</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. 3-Column Technical Feature Grid */}
        <section className="border-t border-[#d0d7de] bg-[#f6f8fa]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-[#ffffff] border border-[#d0d7de] rounded-lg p-5">
                <div className="w-8 h-8 rounded-md bg-[#f6f8fa] border border-[#d0d7de] flex items-center justify-center text-[#1f883d] mb-3.5">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#1f2328] mb-1.5">
                  Zero-Trust Private Repo Support
                </h3>
                <p className="text-xs text-[#656d76] leading-relaxed">
                  Raw source code never leaves your browser tab. GitHub OAuth access tokens remain strictly in browser <code className="font-mono text-[#1f2328]">sessionStorage</code> and are never sent to RepoLens servers.
                </p>
              </div>

              <div className="bg-[#ffffff] border border-[#d0d7de] rounded-lg p-5">
                <div className="w-8 h-8 rounded-md bg-[#f6f8fa] border border-[#d0d7de] flex items-center justify-center text-[#0969da] mb-3.5">
                  <GitFork className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#1f2328] mb-1.5">
                  Interactive Dependency &amp; Blast-Radius Graph
                </h3>
                <p className="text-xs text-[#656d76] leading-relaxed">
                  Click any file block to trace incoming dependents, outgoing imports, and architectural zones with a synced interactive Mini-Map and one-click SVG export.
                </p>
              </div>

              <div className="bg-[#ffffff] border border-[#d0d7de] rounded-lg p-5">
                <div className="w-8 h-8 rounded-md bg-[#f6f8fa] border border-[#d0d7de] flex items-center justify-center text-[#bf8700] mb-3.5">
                  <MessageSquareCode className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-[#1f2328] mb-1.5">
                  Context-Aware AI Copilot
                </h3>
                <p className="text-xs text-[#656d76] leading-relaxed">
                  Ask architectural questions scoped to a single selected file or the entire repository, and jump directly to highlighted modules on the canvas.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#d0d7de] bg-[#ffffff] py-5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#656d76]">
          <span>RepoLens — Privacy-First Repository Architecture Explorer</span>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="hover:text-[#0969da] transition-colors">
              Architecture Workspace
            </Link>
            <span>•</span>
            <span>Client-Side AST Stripping</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
