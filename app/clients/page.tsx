import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { ClientsPage } from "@/components/clients-page"

export default async function Clients() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return <ClientsPage />
}
