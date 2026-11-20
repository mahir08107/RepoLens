'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  Upload,
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Mail,
  Image as ImageIcon,
} from 'lucide-react';
import CursorGrid from '@/frontend/src/components/CursorGrid';
import { API_BASE_URL } from '@/lib/api-config';

interface AttachedImage {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_FILES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export default function FeedbackPage() {
  const [logoError, setLogoError] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [attachments, setAttachments] = useState<AttachedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, []);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    setError(null);
    const list = Array.from(incoming);
    if (list.length === 0) return;

    setAttachments((prev) => {
      const next = [...prev];
      for (const file of list) {
        if (next.length >= MAX_FILES) {
          setError(`Maximum ${MAX_FILES} screenshots allowed.`);
          break;
        }
        if (!ALLOWED_TYPES.has(file.type)) {
          setError('Only PNG, JPEG, WebP, or GIF images are supported.');
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError(`"${file.name}" exceeds the 5MB per-image limit.`);
          continue;
        }
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
      return next;
    });
  }, []);

  // Support Ctrl/Cmd + V screenshot paste anywhere on the page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (submittedTitle) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedImages: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && ALLOWED_TYPES.has(item.type)) {
          const f = item.getAsFile();
          if (f) {
            const ext = item.type.split('/')[1] || 'png';
            const named = new File([f], f.name || `pasted-screenshot-${Date.now()}.${ext}`, {
              type: item.type,
            });
            pastedImages.push(named);
          }
        }
      }
      if (pastedImages.length > 0) {
        addFiles(pastedImages);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles, submittedTitle]);

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || !description.trim()) {
      setError('Please fill out both the Title and Issue Description.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      if (senderEmail.trim()) {
        formData.append('senderEmail', senderEmail.trim());
      }
      attachments.forEach((item) => {
        formData.append('screenshots', item.file, item.file.name);
      });

      const backendUrl = API_BASE_URL || 'http://localhost:8080';
      const res = await fetch(`${backendUrl}/api/feedback`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server responded with status ${res.status}`);
      }

      setSubmittedTitle(title.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not reach the RepoLens backend to deliver feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setTitle('');
    setDescription('');
    setAttachments([]);
    setSubmittedTitle(null);
    setError(null);
  };

  const mailtoFallbackHref = `mailto:contact.repolens@gmail.com?subject=${encodeURIComponent(
    `[RepoLens Feedback] ${title.trim() || 'Issue Report'}`
  )}&body=${encodeURIComponent(description.trim())}`;

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] relative font-sans selection:bg-white selection:text-[#09090B] overflow-x-hidden">
      {/* Interactive WebGL2 CursorGrid Background */}
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

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navigation Bar */}
        <header className="w-full border-b border-[#27272A] bg-[#09090B]/85 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#A1A1AA] hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Home</span>
              </Link>

              <span className="text-[#27272A]">|</span>

              <Link href="/" className="flex items-center space-x-2 shrink-0">
                <div className="h-6 w-6 flex items-center justify-center rounded-md bg-white p-0.5">
                  {!logoError ? (
                    <img
                      src="/logo.png"
                      alt="RepoLens"
                      onError={() => setLogoError(true)}
                      className="h-5 w-5 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-[#09090B] font-mono">RL</span>
                  )}
                </div>
                <span className="font-semibold text-sm text-[#FAFAFA] tracking-[-0.02em]">
                  RepoLens
                </span>
              </Link>
            </div>

            <Link
              href="/dashboard"
              className="h-9 px-4 inline-flex items-center gap-1.5 rounded-full bg-white hover:bg-[#E4E4E7] text-[#09090B] text-xs font-medium transition-colors"
            >
              <span>Open Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Main Bento Layout */}
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left Context Column (lg:col-span-4) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Dark Intro Card */}
              <div className="bg-[#18181B]/90 backdrop-blur-sm border border-[#27272A] rounded-[28px] p-7">
                <div className="font-mono text-[11px] tracking-widest text-[#A1A1AA] uppercase">
                  01 / DIRECT SUPPORT
                </div>
                <h1 className="text-white text-2xl font-medium tracking-[-0.03em] mt-2">
                  Submit Feedback
                </h1>
                <p className="text-[#A1A1AA] text-xs leading-relaxed mt-2">
                  Found an AST parsing edge case, layout bug, or have a feature request? Send it directly to Team DevMap.
                </p>
              </div>

              {/* Direct Contact Card */}
              <div className="bg-[#18181B]/90 backdrop-blur-sm border border-[#27272A] rounded-[28px] p-7">
                <div className="divide-y divide-[#27272A] text-xs font-mono">
                  <div className="pb-3 flex flex-col gap-1">
                    <span className="text-[10px] text-[#71717A] tracking-wider">RECIPIENT</span>
                    <a
                      href="mailto:contact.repolens@gmail.com"
                      className="text-[#FAFAFA] hover:underline break-all"
                    >
                      contact.repolens@gmail.com
                    </a>
                  </div>
                  <div className="py-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#71717A] tracking-wider">TEAM</span>
                    <span className="text-[#FAFAFA]">Team DevMap</span>
                  </div>
                  <div className="pt-3 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#71717A] tracking-wider">RESPONSE SLA</span>
                    <span className="text-[#4ADE80]">&lt; 24 Hours</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Dark Form Card (lg:col-span-8, matching left obsidian cards) */}
            <div className="lg:col-span-8 bg-[#18181B]/90 backdrop-blur-sm text-[#FAFAFA] border border-[#27272A] rounded-[24px] sm:rounded-[28px] p-6 sm:p-10">
              {submittedTitle ? (
                /* Dark Obsidian Success Confirmation State */
                <div className="py-10 text-center flex flex-col items-center">
                  <div className="w-12 h-12 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#4ADE80] mb-5">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-mono text-[11px] uppercase tracking-widest text-[#A1A1AA]">
                    REPORT DELIVERED
                  </div>
                  <h2 className="text-2xl font-medium tracking-[-0.03em] text-white mt-2">
                    Feedback Delivered to contact.repolens@gmail.com
                  </h2>
                  <p className="text-xs text-[#A1A1AA] mt-3 max-w-md leading-relaxed">
                    Thank you for helping improve RepoLens. We&apos;ve received your report{' '}
                    <span className="font-mono font-medium text-white">
                      &ldquo;{submittedTitle}&rdquo;
                    </span>
                    {attachments.length > 0
                      ? ` along with ${attachments.length} attached screenshot${attachments.length > 1 ? 's' : ''}.`
                      : '.'}
                  </p>
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleReset}
                      className="bg-white hover:bg-[#E4E4E7] text-[#09090B] rounded-full px-6 py-2.5 text-xs font-medium transition-colors cursor-pointer"
                    >
                      Submit Another Report
                    </button>
                    <Link
                      href="/dashboard"
                      className="border border-[#3F3F46] hover:border-white text-[#FAFAFA] rounded-full px-5 py-2.5 text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                    >
                      <span>Return to Workspace</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* 1. Title (Required) */}
                  <div>
                    <label
                      htmlFor="feedback-title"
                      className="block font-mono text-[11px] font-medium tracking-wider text-[#A1A1AA] uppercase mb-2"
                    >
                      TITLE *
                    </label>
                    <input
                      id="feedback-title"
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Mermaid edge overlap on monorepo Python imports"
                      className="w-full h-11 px-4 rounded-xl border border-[#27272A] focus:border-[#FAFAFA] focus:outline-none bg-[#09090B] text-sm text-[#FAFAFA] placeholder-[#71717A] transition-colors"
                    />
                  </div>

                  {/* 2. Describe Your Issue (Required) */}
                  <div>
                    <label
                      htmlFor="feedback-description"
                      className="block font-mono text-[11px] font-medium tracking-wider text-[#A1A1AA] uppercase mb-2"
                    >
                      DESCRIBE YOUR ISSUE *
                    </label>
                    <textarea
                      id="feedback-description"
                      required
                      rows={5}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Include repository URL, steps to reproduce, or expected behavior..."
                      className="w-full p-4 rounded-xl border border-[#27272A] focus:border-[#FAFAFA] focus:outline-none bg-[#09090B] text-sm text-[#FAFAFA] placeholder-[#71717A] resize-y transition-colors"
                    />
                  </div>

                  {/* 3. Your Email (Optional — empty by default) */}
                  <div>
                    <label
                      htmlFor="feedback-email"
                      className="block font-mono text-[11px] font-medium tracking-wider text-[#A1A1AA] uppercase mb-2"
                    >
                      YOUR EMAIL (OPTIONAL — FOR FOLLOW-UP)
                    </label>
                    <input
                      id="feedback-email"
                      type="email"
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-11 px-4 rounded-xl border border-[#27272A] focus:border-[#FAFAFA] focus:outline-none bg-[#09090B] text-sm text-[#FAFAFA] placeholder-[#71717A] transition-colors"
                    />
                  </div>

                  {/* 4. Attach Screenshot(s) (Optional) */}
                  <div>
                    <label className="block font-mono text-[11px] font-medium tracking-wider text-[#A1A1AA] uppercase mb-2">
                      ATTACH SCREENSHOT(S) — OPTIONAL
                    </label>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        if (e.dataTransfer.files?.length) {
                          addFiles(e.dataTransfer.files);
                        }
                      }}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                        isDragging
                          ? 'border-white bg-[#27272A]/60'
                          : 'border-[#27272A] hover:border-[#71717A] bg-[#09090B]/70'
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) {
                            addFiles(e.target.files);
                            e.target.value = '';
                          }
                        }}
                      />
                      <Upload className="w-5 h-5 text-[#A1A1AA] mx-auto mb-2" />
                      <div className="text-xs font-medium text-[#FAFAFA]">
                        Click to upload, drag &amp; drop, or press{' '}
                        <kbd className="font-mono px-1.5 py-0.5 rounded bg-[#18181B] border border-[#3F3F46] text-[#E4E4E7] text-[10px]">
                          ⌘V
                        </kbd>{' '}
                        to paste a screenshot
                      </div>
                      <div className="text-[11px] font-mono text-[#71717A] mt-1">
                        PNG, JPEG, WebP, GIF • Up to {MAX_FILES} images, 5MB each
                      </div>
                    </div>

                    {/* Thumbnail Preview Cards */}
                    {attachments.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {attachments.map((item) => (
                          <div
                            key={item.id}
                            className="relative group rounded-xl border border-[#27272A] bg-[#09090B] overflow-hidden"
                          >
                            <div className="aspect-video bg-[#18181B] flex items-center justify-center overflow-hidden">
                              <img
                                src={item.previewUrl}
                                alt={item.file.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-2 flex items-center justify-between gap-1 text-[10px] font-mono">
                              <span className="truncate text-[#E4E4E7]" title={item.file.name}>
                                {item.file.name}
                              </span>
                              <span className="text-[#71717A] shrink-0">
                                {Math.max(1, Math.round(item.file.size / 1024))}KB
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(item.id)}
                              title="Remove screenshot"
                              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#09090B]/90 hover:bg-white text-white hover:text-[#09090B] border border-[#3F3F46] flex items-center justify-center cursor-pointer transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Inline Error Alert with mailto fallback */}
                  {error && (
                    <div className="p-3.5 rounded-xl bg-[#2a1215] border border-red-900/60 text-xs text-red-300 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                        <span>{error}</span>
                      </div>
                      <a
                        href={mailtoFallbackHref}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-white underline underline-offset-4"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Open in Email Client (contact.repolens@gmail.com) ↗</span>
                      </a>
                    </div>
                  )}

                  {/* Submit Row */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#71717A]">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>
                        {attachments.length}/{MAX_FILES} screenshots attached
                      </span>
                    </span>

                    <button
                      type="submit"
                      disabled={submitting || !title.trim() || !description.trim()}
                      className="bg-white hover:bg-[#E4E4E7] disabled:opacity-40 text-[#09090B] rounded-full px-7 py-3 text-xs font-medium inline-flex items-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending Report...</span>
                        </>
                      ) : (
                        <>
                          <span>Send Feedback to RepoLens</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
