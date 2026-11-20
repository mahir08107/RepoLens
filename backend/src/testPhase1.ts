import dotenv from 'dotenv';
import { RepoSkeleton } from '../../shared/types.js';
import { labelModulesWithGemma } from './ai/gemmaLabeler.js';

dotenv.config();

// Realistic mock RepoSkeleton representing a 6-file e-commerce repository
const mockRepo: RepoSkeleton = {
  repoUrl: 'https://github.com/example/ecommerce-core',
  commitSha: 'a1b2c3d4e5f67890123456789abcdef012345678',
  files: [
    {
      filePath: 'src/auth/jwtService.ts',
      imports: ['import jwt from "jsonwebtoken";', 'import { UserPayload } from "./types";'],
      exports: ['generateToken', 'verifyToken', 'revokeSession'],
      functionSignatures: [
        'generateToken(payload: UserPayload): string',
        'verifyToken(token: string): UserPayload | null',
        'revokeSession(userId: string): Promise<boolean>'
      ]
    },
    {
      filePath: 'src/database/schema/orderSchema.ts',
      imports: ['import { pgTable, serial, text, timestamp, numeric } from "drizzle-orm/pg-core";'],
      exports: ['ordersTable', 'orderRelations'],
      functionSignatures: [
        'defineOrderSchema(): TableDefinition',
        'migrateOrders(): Promise<void>'
      ]
    },
    {
      filePath: 'src/payments/stripeGateway.ts',
      imports: ['import Stripe from "stripe";', 'import { PaymentIntentResult } from "./types";'],
      exports: ['createPaymentIntent', 'confirmPayment', 'handleStripeWebhook'],
      functionSignatures: [
        'createPaymentIntent(amountCents: number, currency: string): Promise<PaymentIntentResult>',
        'confirmPayment(paymentIntentId: string): Promise<boolean>',
        'handleStripeWebhook(eventPayload: Buffer, signature: string): Promise<void>'
      ]
    },
    {
      filePath: 'src/interface/components/CheckoutModal.tsx',
      imports: ['import React, { useState } from "react";', 'import { useCart } from "../hooks/useCart";'],
      exports: ['CheckoutModal', 'default'],
      functionSignatures: [
        'CheckoutModal(props: CheckoutModalProps): JSX.Element',
        'handleFormSubmit(event: React.FormEvent): void'
      ]
    },
    {
      filePath: 'src/services/notificationService.ts',
      imports: ['import { Resend } from "resend";', 'import { OrderReceipt } from "../types";'],
      exports: ['sendOrderReceiptEmail', 'sendShippingUpdateSms'],
      functionSignatures: [
        'sendOrderReceiptEmail(recipient: string, order: OrderReceipt): Promise<void>',
        'sendShippingUpdateSms(phone: string, trackingNumber: string): Promise<void>'
      ]
    },
    {
      filePath: 'src/database/connection.ts',
      imports: ['import { Pool } from "pg";', 'import { drizzle } from "drizzle-orm/node-postgres";'],
      exports: ['db', 'connectDatabase', 'disconnectDatabase'],
      functionSignatures: [
        'connectDatabase(): Promise<Pool>',
        'disconnectDatabase(): Promise<void>'
      ]
    }
  ]
};

async function runPhase1Test() {
  console.log('====================================================');
  console.log('   RepoLens Phase 1 Verification Test');
  console.log('====================================================\n');

  console.log(`Repository: ${mockRepo.repoUrl}`);
  console.log(`Commit SHA: ${mockRepo.commitSha}`);
  console.log(`Total files to classify: ${mockRepo.files.length}\n`);

  console.log('Input File Skeletons:');
  mockRepo.files.forEach((f, idx) => {
    console.log(` [${idx + 1}] ${f.filePath}`);
    console.log(`     Imports: ${f.imports.join(' ')}`);
    console.log(`     Exports: ${f.exports.join(', ')}`);
    console.log(`     Signatures: ${f.functionSignatures.join(' | ')}`);
  });

  console.log('\nInvoking labelModulesWithGemma (Gemma 4B)...');
  const startTime = Date.now();

  try {
    const results = await labelModulesWithGemma(mockRepo.files);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\nClassification completed in ${duration}s.`);
    console.log('\n--- Classified Modules Output ---');
    console.log(JSON.stringify(results, null, 2));

    console.log('\n--- Summary Table ---');
    console.table(
      results.map((r) => ({
        File: r.filePath,
        Label: r.label,
        Zone: r.zone,
        Summary: r.summary.length > 50 ? `${r.summary.substring(0, 47)}...` : r.summary
      }))
    );

    console.log('\nPhase 1 verification script executed successfully.');
  } catch (err) {
    console.error('Phase 1 test failed with error:', err);
  }
}

runPhase1Test();

