import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { decrypt } from "@/lib/utils"

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

const projectSchema = z.object({
  clientId: z.number().int().positive(),
  vcpu: z.number().int().positive(),
  ram: z.number().int().positive(),
  storage: z.number().int().positive(),
})

export async function GET(req: NextRequest) {
  try {
    await limiter.check(10, "projects_api") // 10 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const clientId = searchParams.get("clientId")

    const skip = (page - 1) * limit

    const where: any = {}

    if (clientId) {
      where.clientId = Number.parseInt(clientId)
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              _name: true,
            },
          },
        },
      }),
      prisma.project.count({ where }),
    ])

    const projectsWithClientName = projects.map((project) => ({
      ...project,
      clientName: decrypt(project.client._name),
      client: undefined,
    }))

    return NextResponse.json({
      projects: projectsWithClientName,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, "projects_create_api") // 5 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = projectSchema.parse(body)

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const project = await prisma.project.create({
      data: {
        clientId: validatedData.clientId,
        vcpu: validatedData.vcpu,
        ram: validatedData.ram,
        storage: validatedData.storage,
      },
    })

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "PROJECT",
      entityId: project.id,
      oldValues: null,
      newValues: {
        clientId: validatedData.clientId,
        vcpu: validatedData.vcpu,
        ram: validatedData.ram,
        storage: validatedData.storage,
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
