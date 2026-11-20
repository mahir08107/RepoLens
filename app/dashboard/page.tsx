import React, { Suspense } from 'react';
import DashboardWorkspace from '@/components/DashboardWorkspace';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f6f8fa] text-[#656d76] text-sm">
          Loading RepoLens Workspace...
        </div>
      }
    >
      <DashboardWorkspace />
    </Suspense>
  );
}

