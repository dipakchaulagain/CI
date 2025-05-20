import { prisma } from "@/lib/prisma"

type AuditLogData = {
  userId: number | string
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT"
  entityType: string
  entityId: number | string
  oldValues: any
  newValues: any
  ipAddress: string
}

export async function createAuditLog(data: AuditLogData) {
  const userId = typeof data.userId === "string" ? Number.parseInt(data.userId) : data.userId
  const entityId = typeof data.entityId === "string" ? Number.parseInt(data.entityId) : data.entityId

  return prisma.auditLog.create({
    data: {
      userId,
      action: data.action,
      entityType: data.entityType,
      entityId,
      oldValues: data.oldValues ? JSON.stringify(data.oldValues) : null,
      newValues: data.newValues ? JSON.stringify(data.newValues) : null,
      ipAddress: data.ipAddress,
      timestamp: new Date(),
    },
  })
}
