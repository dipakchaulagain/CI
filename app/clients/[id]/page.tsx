import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { ClientDetailPage } from "@/components/client-detail-page"

export default async function ClientDetail({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return <ClientDetailPage id={params.id} />
}
