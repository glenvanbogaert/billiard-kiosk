import { z } from 'zod';

export const memberSchema = z.object({
  id: z.string().or(z.number()),
  full_name: z.string(),
  email: z.string().nullable().optional(),
  date_of_birth: z.date(),
  status: z.enum(['active', 'blocked', 'anonymized']),
  is_blocked_for_topup: z.boolean(),
  preferred_topup_method: z.enum(['epc_qr', 'email_invoice']),
  email_receipts_enabled: z.boolean(),
  email_marketing_enabled: z.boolean(),
  gdpr_consent_at: z.date(),
  gdpr_consent_version: z.string(),
  cached_balance: z.number(),
  is_test: z.boolean()
});

export const drinkSchema = z.object({
  id: z.string().or(z.number()),
  name_nl: z.string(),
  description_nl: z.string().nullable().optional(),
  category_id: z.string().or(z.number()),
  image_path: z.string(),
  purchase_price_excl_vat: z.number(),
  sale_price_incl_vat: z.number(),
  vat_rate: z.number(),
  stock: z.number(),
  low_stock_threshold: z.number(),
  is_active: z.boolean(),
  sort_order: z.number()
});
