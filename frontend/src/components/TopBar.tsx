// frontend/src/components/TopBar.tsx
/**
 * TopBar Component
 *
 * Custom Company Logo Instructions:
 * Place your logo file directly at `public/logo.png` (or `frontend/public/logo.png`).
 */
'use client';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Loader2,
  Github,
  LogOut,
  X,
  GitBranch,
  Code2,
  ChevronDown,
  Lock,
  BookOpen,
  Search,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchUserRepositories, GitHubRepoItem } from '@/frontend/src/services/firebase';

interface TopBarProps {
  onGenerate: (repoUrl: string) => void;
  onOpenInspector: () => void;
  onLoadDemo?: () => void;
  loading: boolean;
  statusText?: string;
  error?: string | null;
  isCopilotOpen?: boolean;
  onToggleCopilot?: () => void;
  hasActiveSelection?: boolean;
  initialRepoUrl?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  onGenerate,
  onOpenInspector,
  onLoadDemo,
  loading,
  statusText,
  error,
  isCopilotOpen = false,
  onToggleCopilot,
  hasActiveSelection = false,
  initialRepoUrl,
}) => {
  const [url, setUrl] = useState(initialRepoUrl || '');
  const [logoError, setLogoError] = useState(false);
  const [localAuthBusy, setLocalAuthBusy] = useState(false);

  const { user: currentUser, githubAccessToken, authLoading, signInWithGithub, signOutUser } = useAuth();

  // Your Repositories Picker Dropdown state
  const [repoDropdownOpen, setRepoDropdownOpen] = useState(false);
  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoFilter, setRepoFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialRepoUrl !== undefined) {
      setUrl(initialRepoUrl);
    }
  }, [initialRepoUrl]);

  // Close repo picker dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setRepoDropdownOpen(false);
      }
    };
    if (repoDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [repoDropdownOpen]);

  const loadUserRepos = async (token: string) => {
    setReposLoading(true);
    setReposError(null);
    try {
      const list = await fetchUserRepositories(token);
      setRepos(list);
    } catch (err: any) {
      setReposError(err?.message || 'Could not load repositories');
    } finally {
      setReposLoading(false);
    }
  };

  // Prefetch repositories when token becomes available
  useEffect(() => {
    if (githubAccessToken && repos.length === 0) {
      loadUserRepos(githubAccessToken);
    }
  }, [githubAccessToken]);

  const filteredRepos = useMemo(() => {
    const q = repoFilter.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.language && r.language.toLowerCase().includes(q))
    );
  }, [repos, repoFilter]);

  const repoBadgeText = useMemo(() => {
    if (!url) return '';
    try {
      const cleaned = url.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      const parts = cleaned.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return `${parts[0]} / ${parts[1]}`;
      }
      return cleaned;
    } catch {
      return '';
    }
  }, [url]);

  const handleSignIn = async () => {
    try {
      setLocalAuthBusy(true);
      await signInWithGithub();
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        console.error('GitHub Auth error:', err);
        alert(`GitHub sign-in error: ${err.message || 'Could not complete sign in.'}`);
      }
    } finally {
      setLocalAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLocalAuthBusy(true);
      setRepos([]);
      setRepoDropdownOpen(false);
      await signOutUser();
    } catch (err) {
      console.error('Sign-out error:', err);
    } finally {
      setLocalAuthBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onGenerate(url.trim());
    }
  };

  const handleSelectRepo = (repo: GitHubRepoItem) => {
    setUrl(repo.html_url);
    setRepoDropdownOpen(false);
    onGenerate(repo.html_url);
  };

  const isAuthWorking = localAuthBusy || authLoading;

  return (
    <header className="min-h-[56px] bg-[#09090B] border-b border-[#27272A] sticky top-0 z-30 transition-all select-none text-[#FAFAFA]">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 py-2 md:py-0 md:h-[56px] flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-2 sm:gap-x-3">
        {/* 1. Left: ← Home + Logo + RepoLens + breadcrumb + AST-ONLY pill */}
        <div className="flex items-center space-x-2 shrink-0 order-1">
          <Link
            href="/"
            title="Back to Landing Page"
            className="h-8 px-2.5 sm:px-3 rounded-md border border-[#27272A] bg-[#18181B] hover:bg-[#27272A] text-xs font-medium text-[#E4E4E7] inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>

          <Link
            href="/"
            title="Back to RepoLens Home"
            className="flex items-center space-x-2 group rounded-md px-1 py-0.5 hover:bg-[#18181B] transition-colors"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-white p-0.5 shrink-0">
              {!logoError ? (
                <img
                  src="/logo.png"
                  alt="Company Logo"
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

            <span className="font-semibold text-[#FAFAFA] text-[15px] tracking-[-0.02em] group-hover:text-white transition-colors">
              RepoLens
            </span>
          </Link>

          <span className="hidden lg:inline text-[#3F3F46] font-light">/</span>

          {repoBadgeText ? (
            <span
              className="hidden lg:inline font-mono text-[11.5px] text-[#A1A1AA] font-medium max-w-[180px] truncate"
              title={repoBadgeText}
            >
              {repoBadgeText}
            </span>
          ) : (
            <span className="hidden lg:inline font-mono text-xs text-[#71717A]">
              No repository loaded
            </span>
          )}

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#18181B] text-[#E4E4E7] border border-[#3F3F46]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            AST-ONLY
          </span>
        </div>

        {/* 2. Center (Row 2 on mobile, inline on md+): Dark-Framed Unified Input Group */}
        <div
          className="order-3 md:order-2 flex items-center w-full md:flex-1 md:max-w-2xl md:mx-2 h-8 rounded-md border border-[#27272A] bg-[#18181B] focus-within:border-[#71717A] transition-all relative"
          ref={dropdownRef}
        >
          {currentUser && (
            <div className="relative h-full shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = !repoDropdownOpen;
                  setRepoDropdownOpen(next);
                  if (next && githubAccessToken && repos.length === 0) {
                    loadUserRepos(githubAccessToken);
                  }
                }}
                className={`h-full px-2.5 text-xs font-medium rounded-l-[5px] border-r border-[#27272A] flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  repoDropdownOpen
                    ? 'bg-[#27272A] text-white'
                    : 'bg-[#18181B] hover:bg-[#27272A] text-[#E4E4E7]'
                }`}
                title="Pick one of your public or private GitHub repositories"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#A1A1AA]" />
                <span className="hidden lg:inline">Your Repos</span>
                <ChevronDown className="w-3 h-3 text-[#A1A1AA]" />
              </button>

              {repoDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 bg-white border border-[#d0d7de] rounded-lg shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 bg-[#f6f8fa] border-b border-[#d0d7de] flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#1f2328] uppercase tracking-wider">
                      Your Repositories {repos.length > 0 ? `(${repos.length})` : ''}
                    </span>
                    {githubAccessToken && (
                      <button
                        type="button"
                        onClick={() => loadUserRepos(githubAccessToken)}
                        disabled={reposLoading}
                        title="Refresh repository list"
                        className="text-[#656d76] hover:text-[#1f2328] p-0.5 rounded transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${reposLoading ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>

                  {!githubAccessToken ? (
                    <div className="p-4 text-center space-y-2.5">
                      <p className="text-xs text-[#656d76]">
                        Reconnect GitHub in this browser session to browse and analyze your private repositories.
                      </p>
                      <button
                        type="button"
                        onClick={handleSignIn}
                        className="h-8 px-3 text-xs font-medium text-white bg-[#1f883d] hover:bg-[#1a7f37] rounded-md inline-flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Reconnect GitHub</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 border-b border-[#d0d7de]">
                        <div className="relative flex items-center">
                          <Search className="w-3.5 h-3.5 text-[#656d76] absolute left-2.5 pointer-events-none" />
                          <input
                            type="text"
                            value={repoFilter}
                            onChange={(e) => setRepoFilter(e.target.value)}
                            placeholder="Filter repositories..."
                            autoFocus
                            className="w-full h-7 pl-8 pr-2 text-xs bg-[#f6f8fa] border border-[#d0d7de] rounded-md focus:bg-white focus:outline-none focus:border-[#0969da] text-[#1f2328] placeholder-[#656d76]"
                          />
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto divide-y divide-[#eaeef2]">
                        {reposLoading ? (
                          <div className="py-8 flex flex-col items-center justify-center text-[#656d76] space-y-2">
                            <Loader2 className="w-4 h-4 animate-spin text-[#0969da]" />
                            <span className="text-xs">Loading repositories...</span>
                          </div>
                        ) : reposError ? (
                          <div className="p-3 text-xs text-[#cf222e] bg-[#ffebe9]">
                            {reposError}
                          </div>
                        ) : filteredRepos.length === 0 ? (
                          <div className="py-6 text-center text-xs text-[#656d76]">
                            No matching repositories found.
                          </div>
                        ) : (
                          filteredRepos.map((repo) => (
                            <button
                              key={repo.id}
                              type="button"
                              onClick={() => handleSelectRepo(repo)}
                              className="w-full text-left px-3 py-2 hover:bg-[#f6f8fa] transition-colors flex items-start justify-between gap-2 cursor-pointer group"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-1.5">
                                  {repo.private ? (
                                    <Lock className="w-3.5 h-3.5 text-[#9a6700] shrink-0" />
                                  ) : (
                                    <BookOpen className="w-3.5 h-3.5 text-[#656d76] shrink-0" />
                                  )}
                                  <span className="font-mono text-xs font-semibold text-[#1f2328] group-hover:text-[#0969da] truncate">
                                    {repo.full_name}
                                  </span>
                                </div>
                                {repo.description && (
                                  <p className="text-[11px] text-[#656d76] truncate mt-0.5 pl-5">
                                    {repo.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center space-x-1.5 shrink-0 pt-0.5">
                                {repo.language && (
                                  <span className="text-[10px] text-[#656d76] font-mono">
                                    {repo.language}
                                  </span>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${
                                    repo.private
                                      ? 'bg-[#fff8c5] text-[#9a6700] border-[#d4a72c]/40'
                                      : 'bg-[#f6f8fa] text-[#656d76] border-[#d0d7de]'
                                  }`}
                                >
                                  {repo.private ? 'Private' : 'Public'}
                                </span>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex-1 h-full min-w-0">
            <div className="flex items-center w-full h-full">
              <div className="pl-2.5 pr-1.5 text-[#71717A] flex items-center pointer-events-none shrink-0">
                <GitBranch className="w-3.5 h-3.5" />
              </div>

              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="flex-1 h-full px-1.5 text-xs font-mono bg-transparent text-white placeholder-[#71717A] focus:outline-none min-w-0"
              />

              {url && !loading && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="px-1.5 text-[#71717A] hover:text-white transition-colors cursor-pointer"
                  title="Clear input"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="h-full px-3.5 rounded-r-[5px] bg-white hover:bg-[#E4E4E7] active:bg-[#D4D4D8] text-[#09090B] text-xs font-medium border-l border-[#27272A] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5 shrink-0 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-[#09090B]" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <span>Analyze</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 3. Right (Row 1 right on mobile): Monochrome Studio Actions (AST Payload, Copilot, User) */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0 order-2 md:order-3">
          {/* Payload Inspector Button */}
          <button
            type="button"
            onClick={onOpenInspector}
            className="h-8 px-2 sm:px-2.5 text-xs font-medium text-[#E4E4E7] bg-[#18181B] hover:bg-[#27272A] border border-[#27272A] rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Inspect privacy-sanitized AST payload"
          >
            <Code2 className="w-3.5 h-3.5 text-[#A1A1AA]" />
            <span className="hidden sm:inline">AST Payload</span>
            <span className="sm:hidden">AST</span>
          </button>

          {/* Copilot Toggle Button */}
          {onToggleCopilot && (
            <button
              type="button"
              onClick={onToggleCopilot}
              title="Toggle AI Architecture Copilot (⌘I)"
              className={`h-8 px-2.5 text-xs font-medium border rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                isCopilotOpen
                  ? 'bg-white text-[#09090B] border-white'
                  : 'bg-[#18181B] text-[#E4E4E7] hover:bg-[#27272A] border-[#27272A]'
              }`}
            >
              <div className="relative flex items-center">
                <span>Copilot</span>
                {hasActiveSelection && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] ml-1.5" />
                )}
              </div>
              <kbd
                className={`text-[10px] font-mono px-1 rounded border ${
                  isCopilotOpen
                    ? 'bg-[#F4F4F5] text-[#09090B] border-[#D4D4D8]'
                    : 'bg-[#09090B] text-[#A1A1AA] border-[#3F3F46]'
                }`}
              >
                ⌘I
              </kbd>
            </button>
          )}

          {/* GitHub Sign-In Button or User Badge */}
          {currentUser ? (
            <div className="h-8 flex items-center space-x-1.5 bg-[#18181B] border border-[#27272A] rounded-md px-2">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-4.5 h-4.5 rounded-full object-cover border border-[#3F3F46]"
                />
              ) : (
                <div className="w-4.5 h-4.5 rounded-full bg-white text-[#09090B] flex items-center justify-center text-[10px] font-bold">
                  {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs font-mono font-medium text-[#FAFAFA] max-w-[90px] truncate hidden sm:inline">
                {currentUser.username || currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0] || 'User'}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isAuthWorking}
                title="Sign out"
                className="pl-1 border-l border-[#27272A] text-[#A1A1AA] hover:text-white transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isAuthWorking}
              className="h-8 px-3 text-xs font-medium text-white bg-[#18181B] hover:bg-[#27272A] border border-[#3F3F46] hover:border-white rounded-md transition-all cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              title="Sign in with GitHub for Private Repos"
            >
              {isAuthWorking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Github className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Sub-bar if loading */}
      {loading && statusText && (
        <div className="bg-[#18181B] border-t border-[#27272A] px-4 py-1 text-[11px] font-mono text-[#E4E4E7] flex items-center justify-center space-x-2">
          <Loader2 className="w-3 h-3 animate-spin text-white" />
          <span>{statusText}</span>
        </div>
      )}

      {/* Error Bar */}
      {error && (
        <div className="bg-[#2a1215] border-t border-red-900/60 px-4 py-1 text-xs text-red-300 flex items-center justify-between">
          <span>⚠️ {error}</span>
        </div>
      )}
    </header>
  );
};

export default TopBar;
