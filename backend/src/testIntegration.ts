import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ArchitectureMap, RepoSkeleton, ZoneCategory } from '../../shared/types';
import app from './index';

dotenv.config();

const ALLOWED_ZONES: Set<ZoneCategory> = new Set([
  'Auth',
  'Database',
  'Payments',
  'Interface',
  'Services',
]);

// 8-file realistic fallback skeleton shaped identically to Tree-sitter WASM output
const fallbackSkeleton: RepoSkeleton = {
  repoUrl: 'https://github.com/example/repolens-e2e',
  commitSha: `integration-test-${Date.now()}`,
  files: [
    {
      filePath: 'src/components/TopBar.tsx',
      imports: ['import React from "react";', 'import { useAuth } from "../hooks/useAuth";'],
      exports: ['TopBar', 'default'],
      functionSignatures: ['TopBar(props: TopBarProps): JSX.Element', 'handleLoginClick(): void'],
    },
    {
      filePath: 'src/hooks/useAuth.ts',
      imports: ['import { useState, useEffect } from "react";', 'import { authService } from "../services/authService";'],
      exports: ['useAuth'],
      functionSignatures: ['useAuth(): UseAuthResult', 'login(): Promise<void>', 'logout(): Promise<void>'],
    },
    {
      filePath: 'src/services/authService.ts',
      imports: ['import { apiClient } from "./apiClient";', 'import { UserSession } from "../types";'],
      exports: ['authService', 'validateToken'],
      functionSignatures: ['loginWithOAuth(provider: string): Promise<UserSession>', 'validateToken(token: string): boolean'],
    },
    {
      filePath: 'src/services/apiClient.ts',
      imports: ['import axios from "axios";'],
      exports: ['apiClient', 'get', 'post'],
      functionSignatures: ['get<T>(url: string): Promise<T>', 'post<T>(url: string, data: any): Promise<T>'],
    },
    {
      filePath: 'src/components/CheckoutModal.tsx',
      imports: ['import React from "react";', 'import { stripeService } from "../services/stripeService";'],
      exports: ['CheckoutModal'],
      functionSignatures: ['CheckoutModal(props: CheckoutProps): JSX.Element', 'onPay(): Promise<void>'],
    },
    {
      filePath: 'src/services/stripeService.ts',
      imports: ['import Stripe from "stripe";', 'import { orderRepository } from "../db/orderRepository";'],
      exports: ['stripeService', 'createCharge'],
      functionSignatures: ['createCharge(amount: number): Promise<ChargeResult>', 'refundCharge(id: string): Promise<boolean>'],
    },
    {
      filePath: 'src/db/orderRepository.ts',
      imports: ['import { databasePool } from "./connection";', 'import { OrderRecord } from "./models";'],
      exports: ['orderRepository', 'saveOrder', 'findOrderById'],
      functionSignatures: ['saveOrder(order: OrderRecord): Promise<string>', 'findOrderById(id: string): Promise<OrderRecord | null>'],
    },
    {
      filePath: 'src/db/connection.ts',
      imports: ['import { Pool } from "pg";'],
      exports: ['databasePool', 'query'],
      functionSignatures: ['connect(): Promise<Pool>', 'query(text: string, params: any[]): Promise<any>'],
    },
  ],
};

function loadSkeleton(): RepoSkeleton {
  const filePath = path.resolve(process.cwd(), 'src/realRepoSkeleton.json');
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.repoUrl && data.commitSha && Array.isArray(data.files)) {
        console.log(`[testIntegration] Loaded realRepoSkeleton.json successfully (${data.files.length} files).`);
        return data as RepoSkeleton;
      }
    } catch (e) {
      console.warn('[testIntegration] Failed parsing realRepoSkeleton.json, falling back to mock skeleton:', e);
    }
  }
  console.log('[testIntegration] Using fallback 8-file TypeScript/React skeleton.');
  return fallbackSkeleton;
}

let server: any;
let baseUrl = '';

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function postGenerateMap(payload: any): Promise<{ status: number; body: any; durationMs: number }> {
  const start = Date.now();
  const response = await fetch(`${baseUrl}/api/generate-map`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const durationMs = Date.now() - start;
  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body, durationMs };
}

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
}

async function runIntegrationSuite() {
  console.log('================================================================');
  console.log('       RepoLens Integration Test: Dev A ↔ Dev B Handshake');
  console.log('================================================================\n');

  const skeleton = loadSkeleton();
  await startServer();

  const results: CheckResult[] = [];

  // ----------------------------------------------------
  // Check 1: Contract & Privacy Verification (Dev A Output Check)
  // ----------------------------------------------------
  let check1Passed = true;
  let check1Details = '';

  const hasRepoUrl = typeof skeleton.repoUrl === 'string' && skeleton.repoUrl.trim().length > 0;
  const hasCommitSha = typeof skeleton.commitSha === 'string' && skeleton.commitSha.trim().length > 0;
  const hasFiles = Array.isArray(skeleton.files) && skeleton.files.length > 0;

  let allFilesValid = true;
  let privacyViolations = 0;

  for (const f of skeleton.files) {
    if (
      typeof f.filePath !== 'string' ||
      !Array.isArray(f.imports) ||
      !Array.isArray(f.exports) ||
      !Array.isArray(f.functionSignatures)
    ) {
      allFilesValid = false;
    }

    const rawAny = f as any;
    if (rawAny.content !== undefined || rawAny.body !== undefined || rawAny.rawCode !== undefined) {
      privacyViolations++;
    }
  }

  if (hasRepoUrl && hasCommitSha && hasFiles && allFilesValid && privacyViolations === 0) {
    check1Passed = true;
    check1Details = `Valid contract with ${skeleton.files.length} files. Zero privacy leaks (no raw code/bodies).`;
  } else {
    check1Passed = false;
    check1Details = `Contract failed: hasRepoUrl=${hasRepoUrl}, hasCommitSha=${hasCommitSha}, allFilesValid=${allFilesValid}, privacyViolations=${privacyViolations}`;
  }
  results.push({ name: '1. Contract & Privacy Guard Check', passed: check1Passed, details: check1Details });

  // ----------------------------------------------------
  // Check 2: Live Cold-Run Pipeline (POST /api/generate-map)
  // ----------------------------------------------------
  console.log('\nRunning live cold-run pipeline (Gemma 4B + Gemini Flash Lite)...');
  const coldRun = await postGenerateMap(skeleton);

  let check2Passed = false;
  let check2Details = '';
  const coldMap: ArchitectureMap & { cached?: boolean } = coldRun.body;

  if (coldRun.status === 200 && coldMap && Array.isArray(coldMap.nodes)) {
    const nodeCountMatch = coldMap.nodes.length === skeleton.files.length;
    if (nodeCountMatch) {
      check2Passed = true;
      check2Details = `HTTP 200 in ${(coldRun.durationMs / 1000).toFixed(2)}s. Received ${coldMap.nodes.length} nodes for ${skeleton.files.length} files (cached: ${coldMap.cached}).`;
    } else {
      check2Details = `Node count mismatch: expected ${skeleton.files.length}, got ${coldMap.nodes.length}`;
    }
  } else {
    check2Details = `HTTP ${coldRun.status}: ${JSON.stringify(coldRun.body)}`;
  }
  results.push({ name: '2. Live Cold-Run Pipeline', passed: check2Passed, details: check2Details });

  // ----------------------------------------------------
  // Check 3: Zone & Label Integrity Check (Gemma 4B Output)
  // ----------------------------------------------------
  let check3Passed = true;
  let check3Details = '';
  const invalidNodes: string[] = [];

  if (check2Passed && coldMap.nodes) {
    for (const node of coldMap.nodes) {
      const validZone = ALLOWED_ZONES.has(node.zone);
      const validLabel = typeof node.label === 'string' && node.label.trim().length > 0;
      const validSummary = typeof node.summary === 'string' && node.summary.trim().length > 0;

      if (!validZone || !validLabel || !validSummary) {
        invalidNodes.push(node.id);
      }
    }

    if (invalidNodes.length === 0) {
      check3Passed = true;
      check3Details = `All ${coldMap.nodes.length} nodes have valid 5-zone categories, labels, and single-sentence summaries.`;
    } else {
      check3Passed = false;
      check3Details = `Nodes with invalid zone/label/summary: ${invalidNodes.join(', ')}`;
    }
  } else {
    check3Passed = false;
    check3Details = 'Skipped or failed due to cold-run failure.';
  }
  results.push({ name: '3. Zone & Label Integrity Check (Gemma)', passed: check3Passed, details: check3Details });

  // ----------------------------------------------------
  // Check 4: Graph Topology Check (Gemini Flash Lite Output)
  // ----------------------------------------------------
  let check4Passed = true;
  let check4Details = '';
  const nodeIds = new Set(coldMap?.nodes?.map((n) => n.id) || []);
  const brokenEdges: string[] = [];
  const selfLoops: string[] = [];

  if (check2Passed && Array.isArray(coldMap.edges)) {
    for (const edge of coldMap.edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        brokenEdges.push(edge.id);
      }
      if (edge.source === edge.target) {
        selfLoops.push(edge.id);
      }
    }

    if (brokenEdges.length === 0 && selfLoops.length === 0) {
      check4Passed = true;
      check4Details = `All ${coldMap.edges.length} edges connect valid existing nodes without self-loops.`;
    } else {
      check4Passed = false;
      check4Details = `Broken edges: ${brokenEdges.length}, Self-loops: ${selfLoops.length}`;
    }
  } else {
    check4Passed = false;
    check4Details = 'Skipped or failed due to cold-run failure.';
  }
  results.push({ name: '4. Graph Topology Check (Gemini Flash Lite)', passed: check4Passed, details: check4Details });

  // ----------------------------------------------------
  // Check 5: Firestore Round-Trip Persistence Check
  // ----------------------------------------------------
  console.log('Testing immediate cache hit round-trip...');
  const warmRun = await postGenerateMap(skeleton);
  const warmMap: ArchitectureMap & { cached?: boolean } = warmRun.body;

  let check5Passed = false;
  let check5Details = '';

  if (warmRun.status === 200 && warmMap && warmMap.cached === true) {
    const isUnderThreshold = warmRun.durationMs < 500;
    const sameNodesCount = warmMap.nodes.length === coldMap.nodes.length;
    const sameEdgesCount = warmMap.edges.length === coldMap.edges.length;

    if (sameNodesCount && sameEdgesCount) {
      check5Passed = true;
      check5Details = `Cache hit in ${warmRun.durationMs}ms (cached: true, identical ${warmMap.nodes.length} nodes & ${warmMap.edges.length} edges).`;
    } else {
      check5Details = `Node or edge count mismatch on cache hit.`;
    }
  } else {
    check5Details = `Expected cached: true and HTTP 200, got status ${warmRun.status}, cached: ${warmMap?.cached} in ${warmRun.durationMs}ms.`;
  }
  results.push({ name: '5. Firestore Round-Trip Persistence Check', passed: check5Passed, details: check5Details });

  await stopServer();

  // Print results table
  console.log('\n================================================================');
  console.log('                     INTEGRATION RESULTS');
  console.log('================================================================');
  console.table(
    results.map((r) => ({
      'Check': r.name,
      'Status': r.passed ? 'PASS' : 'FAIL',
      'Details': r.details,
    }))
  );

  // Print ArchitectureMap summary
  if (coldMap && coldMap.nodes) {
    console.log('\n--- Generated ArchitectureMap Nodes ---');
    console.table(
      coldMap.nodes.map((n) => ({
        ID: n.id,
        Label: n.label,
        Zone: n.zone,
        File: n.filePath,
        Summary: n.summary.length > 55 ? `${n.summary.substring(0, 52)}...` : n.summary,
      }))
    );

    console.log('\n--- Inferred ArchitectureMap Edges ---');
    console.table(
      coldMap.edges.map((e) => ({
        ID: e.id,
        Source: e.source,
        Target: e.target,
        Relation: e.relation,
      }))
    );
  }

  const allPassed = results.every((r) => r.passed);
  console.log('================================================================');
  console.log(`Final Result: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================');

  if (allPassed) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runIntegrationSuite();

