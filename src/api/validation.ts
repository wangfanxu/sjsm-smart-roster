import { ApiError } from "./errors";
import { z } from "zod";

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Expected a valid calendar date");

export const planningPeriodInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    startsOn: calendarDate,
    endsOn: calendarDate,
  })
  .refine((value) => value.startsOn <= value.endsOn, {
    path: ["endsOn"],
    message: "endsOn must be on or after startsOn",
  });

export const serviceInput = z.object({
  title: z.string().trim().min(1).max(160),
  startsAt: z.iso.datetime({ offset: true }),
  notes: z.string().trim().max(2000).nullable().optional(),
  requirements: z
    .array(
      z.object({
        roleId: z.uuid(),
        requiredCount: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .superRefine((requirements, context) => {
      const seen = new Set<string>();
      requirements.forEach((requirement, index) => {
        if (seen.has(requirement.roleId)) {
          context.addIssue({
            code: "custom",
            path: [index, "roleId"],
            message: "A role can appear only once per service",
          });
        }
        seen.add(requirement.roleId);
      });
    }),
});

export const createRoleInput = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case"),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateProfileInput = z
  .object({
    displayName: z.string().trim().min(1).max(160),
  })
  .strict();

export const createReplacementRequestInput = z
  .object({
    assignmentId: z.uuid(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const approveReplacementRequestInput = z
  .object({
    replacementUserId: z.uuid(),
  })
  .strict();

export const pendingUserInput = z
  .object({
    email: z.string().trim().toLowerCase().email().max(255),
    displayName: z.string().trim().min(1).max(160),
    systemRole: z.enum(["volunteer", "team_leader", "administrator"]),
  })
  .strict();

export const memberRolesInput = z.object({
  capabilities: z
    .array(
      z.object({
        roleId: z.uuid(),
        proficiency: z.enum(["primary", "secondary"]),
      }),
    )
    .max(30)
    .superRefine((capabilities, context) => {
      const seen = new Set<string>();
      capabilities.forEach((capability, index) => {
        if (seen.has(capability.roleId)) {
          context.addIssue({
            code: "custom",
            path: [index, "roleId"],
            message: "A member role can appear only once",
          });
        }
        seen.add(capability.roleId);
      });
    }),
});

export const availabilityInput = z.object({
  serviceDate: calendarDate,
  status: z.enum(["available", "unavailable", "preferred"]),
  note: z.string().trim().max(500).nullable().optional(),
});

export const dateRangeQuery = z.object({
  from: calendarDate.optional(),
  to: calendarDate.optional(),
});

export const assignmentRangeQuery = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

export const candidateGenerationInput = z
  .object({
    weights: z
      .object({
        primaryRole: z.number().int().min(0).max(100).optional(),
        preferredAvailability: z.number().int().min(0).max(100).optional(),
        loadBalance: z.number().int().min(0).max(100).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const assignmentUpdateInput = z
  .object({
    isLocked: z.boolean().optional(),
    userId: z.uuid().optional(),
  })
  .strict()
  .refine((value) => value.isLocked !== undefined || value.userId !== undefined, {
    message: "Provide isLocked or userId",
  });

export const assistantAskInput = z
  .object({
    message: z.string().trim().min(1).max(500),
  })
  .strict();

export const assistantConfirmInput = z
  .object({
    confirmationToken: z.string().trim().min(1),
  })
  .strict();

export const uuidParameter = z.uuid();

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("invalid_json", 400, "The request body must be valid JSON");
  }
  return schema.parse(body);
}

export function searchParamsObject(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
