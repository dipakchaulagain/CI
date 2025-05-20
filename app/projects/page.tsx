import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { ProjectsPage } from "@/components/projects-page"

export default async function Projects() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  return <ProjectsPage />
}
