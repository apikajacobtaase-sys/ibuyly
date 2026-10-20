// src/lib/validators/payment.ts
import { z } from "zod";

// Schema for a single cart item sent from the client
export const CartItemSchema = z.object({
  productId: z.string().cuid("Invalid product ID format"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

// Schema for the payment initialization request
export const InitializePaymentSchema = z.object({
  email: z.string().email("Invalid email address"),
  shippingAddressId: z.string().cuid("Invalid address ID format"),
  // Add to the InitializePaymentSchema:
  voucherCode: z.string().max(50).optional(),
  items: z
    .array(CartItemSchema)
    .min(1, "Cart must contain at least one item")
    .max(50, "Cart cannot contain more than 50 items"),
  // NOTE: We intentionally DO NOT accept `amount` or `price` from the client.
  // The server will calculate the authoritative total from DB prices.
});

// Schema for the payment verification request
export const VerifyPaymentSchema = z.object({
  reference: z.string().min(1, "Reference is required"),
});

// Inferred TypeScript types
export type CartItemInput = z.infer<typeof CartItemSchema>;
export type InitializePaymentInput = z.infer<typeof InitializePaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;