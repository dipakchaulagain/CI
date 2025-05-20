import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { UsersPage } from "@/components/users-page"

export default async function Users() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  const { user } = session

  if (!user.isAdmin) {
    redirect("/")
  }

  return <UsersPage />
}
