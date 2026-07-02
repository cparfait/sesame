import { prisma } from "./db";

export async function audit(
  action: string,
  opts: { userId?: string; cible?: string; details?: string } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        userId: opts.userId,
        cible: opts.cible,
        details: opts.details,
      },
    });
  } catch (e) {
    console.error("Audit log error", e);
  }
}
