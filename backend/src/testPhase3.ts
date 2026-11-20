import dotenv from 'dotenv';
import { ArchitectureMap, RepoSkeleton } from '../../shared/types';
import { saveCachedMap } from './db/firestoreCache';
import app from './index';

dotenv.config();

// Realistic demo-shop skeleton
const demoRepo: RepoSkeleton = {
  repoUrl: 'https://github.com/example/demo-shop',
  commitSha: 'abc123456',
  files: [
    {
      filePath: 'src/pages/CheckoutPage.tsx',
      imports: [
        'import React from "react";',
        'import { processPayment } from "../services/stripeService";',
        'import { useAuth } from "../hooks/useAuth";',
      ],
      exports: ['CheckoutPage', 'default'],
      functionSignatures: ['CheckoutPage(): JSX.Element', 'handleCheckout(): Promise<void>'],
    },
    {
      filePath: 'src/services/stripeService.ts',
      imports: ['import Stripe from "stripe";', 'import { saveOrder } from "../models/orderModel";'],
      exports: ['processPayment', 'refundPayment'],
      functionSignatures: [
        'processPayment(amount: number, token: string): Promise<PaymentResult>',
        'refundPayment(chargeId: string): Promise<boolean>',
      ],
    },
    {
      filePath: 'src/hooks/useAuth.ts',
      imports: ['import { useState, useEffect } from "react";'],
      exports: ['useAuth'],
      functionSignatures: ['useAuth(): { user: User | null, isAuthenticated: boolean }'],
    },
    {
      filePath: 'src/models/orderModel.ts',
      imports: ['import { db } from "../db/connection";'],
      exports: ['saveOrder', 'getOrderById'],
      functionSignatures: [
        'saveOrder(orderData: OrderInput): Promise<OrderRecord>',
        'getOrderById(id: string): Promise<OrderRecord | null>',
      ],
    },
  ],
};

// Cached ArchitectureMap for demoRepo commitSha "abc123456"
const demoCachedMap: ArchitectureMap = {
  repoUrl: demoRepo.repoUrl,
  commitSha: demoRepo.commitSha,
  nodes: [
    {
      id: 'node-0',
      label: 'Checkout Page',
      filePath: 'src/pages/CheckoutPage.tsx',
      zone: 'Interface',
      summary: 'Main checkout user interface component.',
    },
    {
      id: 'node-1',
      label: 'Stripe Service',
      filePath: 'src/services/stripeService.ts',
      zone: 'Payments',
      summary: 'Payment processing gateway and order trigger.',
    },
    {
      id: 'node-2',
      label: 'Auth Hook',
      filePath: 'src/hooks/useAuth.ts',
      zone: 'Auth',
      summary: 'React authentication state management hook.',
    },
    {
      id: 'node-3',
      label: 'Order Model',
      filePath: 'src/models/orderModel.ts',
      zone: 'Database',
      summary: 'Database order persistence and queries.',
    },
  ],
  edges: [
    {
      id: 'edge-0',
      source: 'node-0',
      target: 'node-1',
      relation: 'calls processPayment',
    },
    {
      id: 'edge-1',
      source: 'node-0',
      target: 'node-2',
      relation: 'uses useAuth',
    },
    {
      id: 'edge-2',
      source: 'node-1',
      target: 'node-3',
      relation: 'calls saveOrder',
    },
  ],
};

let server: any;
let baseUrl = '';

async function startTestServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://localhost:${port}`;
      console.log(`[testPhase3] Test server running on ${baseUrl}`);
      resolve();
    });
  });
}

async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
    } else {
      resolve();
    }
  });
}

async function postChat(payload: any): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body: any;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

async function runPhase3Tests() {
  console.log('========================================================');
  console.log('         RepoLens Phase 3 Verification Suite');
  console.log('========================================================\n');

  await startTestServer();

  // Populate cache for abc123456
  await saveCachedMap(demoRepo.commitSha, demoCachedMap);

  let passedCount = 0;
  const totalTests = 4;

  // ----------------------------------------------------
  // Test Case 1: Node-Contextual Dependency Query
  // ----------------------------------------------------
  console.log('Test Case 1: Node-Contextual Dependency Query');
  try {
    const res = await postChat({
      commitSha: 'abc123456',
      selectedNodeId: 'node-2',
      question: 'What depends on the auth module?',
      skeleton: demoRepo,
    });

    const isNonEmptyAnswer = typeof res.body?.answer === 'string' && res.body.answer.trim().length > 0;
    const highlighted: string[] = res.body?.highlightedNodeIds || [];
    const hasExpectedNodes = highlighted.includes('node-0') || highlighted.includes('node-2');

    console.log(` Status: ${res.status}`);
    console.log(` Answer: "${res.body?.answer}"`);
    console.log(` HighlightedNodeIds: ${JSON.stringify(highlighted)}`);

    if (res.status === 200 && isNonEmptyAnswer && hasExpectedNodes) {
      console.log(' Result: PASS\n');
      passedCount++;
    } else {
      console.error(` Result: FAIL (status: ${res.status}, hasExpectedNodes: ${hasExpectedNodes})\n`);
    }
  } catch (err) {
    console.error(' Result: FAIL with exception:', err, '\n');
  }

  // ----------------------------------------------------
  // Test Case 2: General Feature Location Query (No Node Selected)
  // ----------------------------------------------------
  console.log('Test Case 2: General Feature Location Query (No Node Selected)');
  try {
    const res = await postChat({
      commitSha: 'abc123456',
      selectedNodeId: undefined,
      question: 'Where do we process credit card payments?',
      skeleton: demoRepo,
    });

    const answer = res.body?.answer || '';
    const highlighted: string[] = res.body?.highlightedNodeIds || [];
    const mentionsStripe = /stripe/i.test(answer) || /payments/i.test(answer);
    const hasNode1 = highlighted.includes('node-1');

    console.log(` Status: ${res.status}`);
    console.log(` Answer: "${answer}"`);
    console.log(` HighlightedNodeIds: ${JSON.stringify(highlighted)}`);

    if (res.status === 200 && mentionsStripe && hasNode1) {
      console.log(' Result: PASS\n');
      passedCount++;
    } else {
      console.error(` Result: FAIL (status: ${res.status}, mentionsStripe: ${mentionsStripe}, hasNode1: ${hasNode1})\n`);
    }
  } catch (err) {
    console.error(' Result: FAIL with exception:', err, '\n');
  }

  // ----------------------------------------------------
  // Test Case 3: Cache-Miss / Uncached Commit Fallback
  // ----------------------------------------------------
  console.log('Test Case 3: Cache-Miss / Uncached Commit Fallback');
  try {
    const res = await postChat({
      commitSha: 'uncached-sha-999',
      selectedNodeId: undefined,
      question: 'How are orders saved to the database?',
      skeleton: demoRepo,
    });

    const isNonEmpty = typeof res.body?.answer === 'string' && res.body.answer.trim().length > 0;

    console.log(` Status: ${res.status}`);
    console.log(` Answer: "${res.body?.answer}"`);
    console.log(` HighlightedNodeIds: ${JSON.stringify(res.body?.highlightedNodeIds)}`);

    if (res.status === 200 && isNonEmpty) {
      console.log(' Result: PASS\n');
      passedCount++;
    } else {
      console.error(` Result: FAIL (status: ${res.status}, isNonEmpty: ${isNonEmpty})\n`);
    }
  } catch (err) {
    console.error(' Result: FAIL with exception:', err, '\n');
  }

  // ----------------------------------------------------
  // Test Case 4: Validation / Bad Request Guard
  // ----------------------------------------------------
  console.log('Test Case 4: Validation / Bad Request Guard');
  try {
    const res = await postChat({
      commitSha: 'abc123456',
      question: '', // Empty question
      skeleton: demoRepo,
    });

    console.log(` Status: ${res.status}`);
    console.log(` Response Body: ${JSON.stringify(res.body)}`);

    if (res.status === 400 && res.body?.error) {
      console.log(' Result: PASS\n');
      passedCount++;
    } else {
      console.error(` Result: FAIL (expected 400 with error, got: ${res.status})\n`);
    }
  } catch (err) {
    console.error(' Result: FAIL with exception:', err, '\n');
  }

  await stopTestServer();

  console.log('========================================================');
  console.log(`Test Summary: ${passedCount}/${totalTests} Passed`);
  console.log('========================================================');

  if (passedCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runPhase3Tests();

