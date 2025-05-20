import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AuditLogsPage } from "@/components/audit-logs-page"

export default async function AuditLogs() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const { user } = session

  if (!user.isAdmin) {
    redirect("/")
  }

  return <AuditLogsPage />
}
