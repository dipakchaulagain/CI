import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { NetworksPage } from "@/components/networks-page"

export default async function Networks() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return <NetworksPage />
}
