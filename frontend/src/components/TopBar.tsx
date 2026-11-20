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
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { fetchUserRepositories, GitHubRepoItem } from '@/frontend/src/services/firebase';

interface TopBarProps {
  onGenerate: (repoUrl: string) => void;
  onOpenInspector: () => void;
  onLoadDemo: () => void;
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
  const [url, setUrl] = useState(initialRepoUrl || 'https://github.com/mahir08107/RepoLens');
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
    if (initialRepoUrl) {
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
    <header className="h-[56px] min-h-[56px] bg-[#f6f8fa] border-b border-[#d0d7de] sticky top-0 z-30 transition-all select-none">
      <div className="max-w-[1920px] h-full mx-auto px-4 flex items-center justify-between gap-3">
        {/* 1. Left: Clickable Logo + RepoLens (Home) + / breadcrumb + repo badge + AST-Only pill */}
        <div className="flex items-center space-x-2 shrink-0">
          <Link
            href="/"
            title="Back to RepoLens Home"
            className="flex items-center space-x-2 group rounded-md px-1 py-0.5 -ml-1 hover:bg-[#eaeef2]/70 transition-colors"
          >
            <div className="flex items-center justify-center h-7 w-7 shrink-0">
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
                  className="h-7 w-7 object-contain rounded-md"
                />
              ) : (
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-[#1f2328] text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 text-[#79c0ff]"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                </div>
              )}
            </div>

            <span className="font-semibold text-[#1f2328] text-[15px] tracking-tight group-hover:text-[#0969da] transition-colors">
              RepoLens
            </span>
          </Link>

          <span className="text-[#d0d7de] font-light">/</span>

          {repoBadgeText && (
            <span
              className="hidden md:inline font-mono text-[11.5px] text-[#57606a] font-medium max-w-[190px] truncate"
              title={repoBadgeText}
            >
              {repoBadgeText}
            </span>
          )}

          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#ddf4ff] text-[#0969da] border border-[#54aeff]/30">
            AST-Only
          </span>
        </div>

        {/* 2. Center: GitHub Primer Input Group + 1-Click Your Repositories Picker */}
        <div className="flex items-center flex-1 max-w-2xl mx-2 gap-1.5 relative" ref={dropdownRef}>
          {currentUser && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  const next = !repoDropdownOpen;
                  setRepoDropdownOpen(next);
                  if (next && githubAccessToken && repos.length === 0) {
                    loadUserRepos(githubAccessToken);
                  }
                }}
                className={`h-8 px-2.5 text-xs font-medium rounded-md border flex items-center space-x-1.5 transition-colors cursor-pointer ${
                  repoDropdownOpen
                    ? 'bg-[#eaeef2] border-[#0969da] text-[#1f2328]'
                    : 'bg-white hover:bg-[#f6f8fa] border-[#d0d7de] text-[#24292f]'
                }`}
                title="Pick one of your public or private GitHub repositories"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#656d76]" />
                <span className="hidden lg:inline">Your Repos</span>
                <ChevronDown className="w-3 h-3 text-[#656d76]" />
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

          <form onSubmit={handleSubmit} className="flex-1 min-w-0">
            <div className="flex items-center w-full h-8 rounded-md border border-[#d0d7de] bg-white shadow-2xs overflow-hidden focus-within:border-[#0969da] focus-within:ring-2 focus-within:ring-[#0969da]/20 transition-all">
              <div className="pl-2.5 pr-1.5 text-[#656d76] flex items-center pointer-events-none shrink-0">
                <GitBranch className="w-3.5 h-3.5" />
              </div>

              <input
                type="text"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                className="flex-1 h-full px-1.5 text-xs font-mono bg-transparent text-[#1f2328] placeholder-[#656d76] focus:outline-none min-w-0"
              />

              {url && !loading && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="px-1.5 text-[#656d76] hover:text-[#1f2328] transition-colors cursor-pointer"
                  title="Clear input"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="h-full px-3.5 bg-[#1f883d] hover:bg-[#1a7f37] active:bg-[#176f30] text-white text-xs font-medium border-l border-[#d0d7de] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center space-x-1.5 shrink-0 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <span>Analyze</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 3. Right: Compact Primer Buttons (Demo, AST, Copilot, Sign In) */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Demo Button */}
          <button
            type="button"
            onClick={onLoadDemo}
            title="Load sample architecture map"
            className="h-8 px-2.5 text-xs font-medium text-[#24292f] bg-[#f6f8fa] hover:bg-[#eaeef2] active:bg-[#e1e4e8] border border-[#d0d7de] rounded-md transition-colors cursor-pointer"
          >
            Demo
          </button>

          {/* Payload Inspector Button */}
          <button
            type="button"
            onClick={onOpenInspector}
            className="h-8 px-2.5 text-xs font-medium text-[#24292f] bg-[#f6f8fa] hover:bg-[#eaeef2] active:bg-[#e1e4e8] border border-[#d0d7de] rounded-md flex items-center space-x-1 transition-colors cursor-pointer"
            title="Inspect privacy-sanitized AST payload"
          >
            <Code2 className="w-3.5 h-3.5 text-[#656d76]" />
            <span>AST</span>
          </button>

          {/* Copilot Toggle Button */}
          {onToggleCopilot && (
            <button
              type="button"
              onClick={onToggleCopilot}
              title="Toggle AI Architecture Copilot (⌘I)"
              className={`h-8 px-2.5 text-xs font-medium border rounded-md flex items-center space-x-1.5 transition-all cursor-pointer ${
                isCopilotOpen
                  ? 'bg-[#ddf4ff] text-[#0969da] border-[#0969da] shadow-2xs'
                  : 'bg-[#f6f8fa] text-[#24292f] hover:bg-[#eaeef2] border-[#d0d7de]'
              }`}
            >
              <div className="relative flex items-center">
                <span>Copilot</span>
                {hasActiveSelection && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1f883d] ml-1" />
                )}
              </div>
              <kbd
                className={`text-[10px] font-mono px-1 py-0.2 rounded border ${
                  isCopilotOpen
                    ? 'bg-white text-[#0969da] border-[#54aeff]/50'
                    : 'bg-white text-[#656d76] border-[#d0d7de]'
                }`}
              >
                ⌘I
              </kbd>
            </button>
          )}

          {/* GitHub Sign-In Button or User Badge */}
          {currentUser ? (
            <div className="h-8 flex items-center space-x-1.5 bg-[#f6f8fa] border border-[#d0d7de] rounded-md px-2 shadow-2xs">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName || 'User'}
                  className="w-4.5 h-4.5 rounded-full object-cover border border-[#d0d7de]"
                />
              ) : (
                <div className="w-4.5 h-4.5 rounded-full bg-[#1f2328] text-white flex items-center justify-center text-[10px] font-bold">
                  {(currentUser.displayName || currentUser.email || 'G')[0].toUpperCase()}
                </div>
              )}
              <span className="text-xs font-medium text-[#1f2328] max-w-[90px] truncate hidden sm:inline">
                {currentUser.username || currentUser.displayName?.split(' ')[0] || currentUser.email?.split('@')[0] || 'User'}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isAuthWorking}
                title="Sign out"
                className="pl-1 border-l border-[#d0d7de] text-[#656d76] hover:text-[#cf222e] transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isAuthWorking}
              className="h-8 px-2.5 text-xs font-medium text-white bg-[#24292f] hover:bg-[#1f2328] active:bg-[#15171a] border border-[#1b1f24] rounded-md transition-all shadow-2xs cursor-pointer flex items-center space-x-1.5 disabled:opacity-60"
              title="Sign in with GitHub for Private Repos"
            >
              {isAuthWorking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Github className="w-3.5 h-3.5 text-white" />
              )}
              <span className="hidden sm:inline">Sign in for Private Repos</span>
              <span className="sm:hidden">Sign in</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Sub-bar if loading */}
      {loading && statusText && (
        <div className="bg-[#ddf4ff] border-t border-[#54aeff]/30 px-4 py-1 text-[11px] text-[#0969da] font-medium flex items-center justify-center space-x-2">
          <Loader2 className="w-3 h-3 animate-spin text-[#0969da]" />
          <span>{statusText}</span>
        </div>
      )}

      {/* Error Bar */}
      {error && (
        <div className="bg-[#ffebe9] border-t border-[#ff8182]/50 px-4 py-1 text-xs text-[#cf222e] flex items-center justify-between">
          <span>⚠️ {error}</span>
        </div>
      )}
    </header>
  );
};

export default TopBar;
