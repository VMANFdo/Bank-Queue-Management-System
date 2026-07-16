import { z } from "zod";

export const issueTicketSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  serviceId: z.string().uuid("Invalid service ID"),
  pool: z.enum(["appointment", "priority", "standard"]),
  customerDetails: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().regex(/^\+?[0-9]{9,15}$/, "Invalid phone number format"),
    nic: z.string().optional().refine((val) => {
      if (!val) return true;
      // 9 digits followed by v/V/x/X or 12 digits
      return /^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(val);
    }, "Invalid Sri Lankan NIC format"),
  }),
  linkedServiceId: z.string().uuid("Invalid linked service ID").optional(),
  language: z.enum(["en", "si", "ta"]).default("en"),
});

export const checkInAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid appointment ID"),
  method: z.enum(["app", "kiosk"]),
});

export const callNextSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID"),
});

export const markDoneSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
});

export const transferSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
  destinationServiceId: z.string().uuid("Invalid destination service ID"),
  reason: z.enum(["normal", "wrong_counter"]),
});

export const noShowSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
});

export const recallSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
});

export const startBreakSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID"),
  expectedMinutes: z.number().int().min(1, "Expected minutes must be at least 1"),
});

export const endBreakSchema = z.object({
  counterId: z.string().uuid("Invalid counter ID"),
});

export const bookAppointmentSchema = z.object({
  branchId: z.string().uuid("Invalid branch ID"),
  serviceId: z.string().uuid("Invalid service ID"),
  slotTime: z.string().datetime("Invalid slot time"),
  customerDetails: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    phone: z.string().regex(/^\+?[0-9]{9,15}$/, "Invalid phone number format"),
    nic: z.string().optional().refine((val) => {
      if (!val) return true;
      return /^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(val);
    }, "Invalid Sri Lankan NIC format"),
  }),
  language: z.enum(["en", "si", "ta"]).default("en"),
});

export const feedbackSchema = z.object({
  ticketId: z.string().uuid("Invalid ticket ID"),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string()).optional(),
  comment: z.string().max(200, "Comment cannot exceed 200 characters").optional(),
});
