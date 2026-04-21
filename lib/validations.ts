import { z } from 'zod';

// Esquemas de validación con Zod

export const productSchema = z.object({
  code: z.string()
    .min(1, 'El código es requerido')
    .regex(/^[a-zA-Z0-9-]+$/, 'El código solo puede contener letras, números y guiones'),
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(255, 'El nombre no puede exceder 255 caracteres'),
  description: z.string().optional(),
  price: z.number()
    .positive('El precio debe ser mayor a 0'),
  cost: z.number()
    .min(0, 'El costo debe ser >= 0')
    .optional()
    .default(0),
});

export const stockMovementSchema = z.object({
  type: z.enum(['in', 'out']),
  quantity: z.number()
    .int('La cantidad debe ser un número entero')
    .positive('La cantidad debe ser mayor a 0'),
  notes: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres')
});
