import dotenv from 'dotenv';
import { RepoSkeleton } from '../../shared/types.js';
import { getCachedMap, saveCachedMap } from './db/firestoreCache.js';
import { labelModulesWithGemma } from './ai/gemmaLabeler.js';
import { buildArchitectureMap } from './ai/geminiArchitect.js';

dotenv.config();

// Realistic mock RepoSkeleton representing a 6-file e-commerce repository
const mockRepo: RepoSkeleton = {
  repoUrl: 'https://github.com/example/ecommerce-core',
  commitSha: 'commit-phase2-test-sha-1234567890',
  files: [
    {
      filePath: 'src/auth/jwtService.ts',
      imports: ['import jwt from "jsonwebtoken";', 'import { UserPayload } from "./types";'],
      exports: ['generateToken', 'verifyToken', 'revokeSession'],
      functionSignatures: [
        'generateToken(payload: UserPayload): string',
        'verifyToken(token: string): UserPayload | null',
        'revokeSession(userId: string): Promise<boolean>',
      ],
    },
    {
      filePath: 'src/database/schema/orderSchema.ts',
      imports: ['import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";'],
      exports: ['ordersTable', 'orderRelations'],
      functionSignatures: [
        'defineOrderSchema(): TableDefinition',
        'migrateOrders(): Promise<void>',
      ],
    },
    {
      filePath: 'src/payments/stripeGateway.ts',
      imports: ['import Stripe from "stripe";', 'import { PaymentIntentResult } from "./types";'],
      exports: ['createPaymentIntent', 'confirmPayment', 'handleStripeWebhook'],
      functionSignatures: [
        'createPaymentIntent(amountCents: number, currency: string): Promise<PaymentIntentResult>',
        'confirmPayment(paymentIntentId: string): Promise<boolean>',
        'handleStripeWebhook(eventPayload: Buffer, signature: string): Promise<void>',
      ],
    },
    {
      filePath: 'src/interface/components/CheckoutModal.tsx',
      imports: [
        'import React, { useState } from "react";',
        'import { sendOrderReceiptEmail } from "../../services/notificationService";',
        'import { createPaymentIntent } from "../../payments/stripeGateway";',
      ],
      exports: ['CheckoutModal', 'default'],
      functionSignatures: [
        'CheckoutModal(props: CheckoutModalProps): JSX.Element',
        'handleFormSubmit(event: React.FormEvent): void',
      ],
    },
    {
      filePath: 'src/services/notificationService.ts',
      imports: ['import { Resend } from "resend";', 'import { OrderReceipt } from "../types";'],
      exports: ['sendOrderReceiptEmail', 'sendShippingUpdateSms'],
      functionSignatures: [
        'sendOrderReceiptEmail(recipient: string, order: OrderReceipt): Promise<void>',
        'sendShippingUpdateSms(phone: string, trackingNumber: string): Promise<void>',
      ],
    },
    {
      filePath: 'src/database/connection.ts',
      imports: ['import { Pool } from "pg";', 'import { drizzle } from "drizzle-orm/node-postgres";'],
      exports: ['db', 'connectDatabase', 'disconnectDatabase'],
      functionSignatures: [
        'connectDatabase(): Promise<Pool>',
        'disconnectDatabase(): Promise<void>',
      ],
    },
  ],
};

async function executePipeline(skeleton: RepoSkeleton): Promise<{ map: any; cached: boolean }> {
  // 1. Check cache
  const cached = await getCachedMap(skeleton.commitSha);
  if (cached) {
    return { map: cached, cached: true };
  }

  // 2. Cache miss: run Gemma Labeler
  const labeled = await labelModulesWithGemma(skeleton.files);

  // 3. Run Gemini Architect
  const architectureMap = await buildArchitectureMap(skeleton, labeled);

  // 4. Save to cache
  await saveCachedMap(skeleton.commitSha, architectureMap);

  return { map: architectureMap, cached: false };
}

async function runPhase2Test() {
  console.log('========================================================');
  console.log('       RepoLens Phase 2 End-to-End Verification');
  console.log('========================================================\n');

  console.log('--- TEST RUN 1: Cache Miss Scenario ---');
  const start1 = Date.now();
  const run1 = await executePipeline(mockRepo);
  const dur1 = ((Date.now() - start1) / 1000).toFixed(2);

  console.log(`Run 1 completed in ${dur1}s. Cached: ${run1.cached}`);
  console.log(`Generated Nodes: ${run1.map.nodes.length}`);
  console.log(`Generated Edges: ${run1.map.edges.length}\n`);

  console.log('Nodes:');
  console.table(
    run1.map.nodes.map((n: any) => ({
      ID: n.id,
      Label: n.label,
      Zone: n.zone,
      File: n.filePath,
    }))
  );

  console.log('\nEdges:');
  console.table(
    run1.map.edges.map((e: any) => ({
      ID: e.id,
      Source: e.source,
      Target: e.target,
      Relation: e.relation,
    }))
  );

  console.log('\n--- TEST RUN 2: Cache Hit Scenario ---');
  const start2 = Date.now();
  const run2 = await executePipeline(mockRepo);
  const dur2 = ((Date.now() - start2) / 1000).toFixed(4);

  console.log(`Run 2 completed in ${dur2}s. Cached: ${run2.cached}`);

  if (run2.cached === true) {
    console.log('SUCCESS: Cache hit confirmed on second execution!');
  } else {
    console.error('FAILURE: Expected cache hit on second execution.');
  }

  console.log('\n========================================================');
  console.log('Phase 2 verification script completed successfully.');
  console.log('========================================================');
}

runPhase2Test();

