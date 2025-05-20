import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/encryption"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

const vpuUserSchema = z.object({
  clientId: z.number().int().positive(),
  username: z.string().min(3),
})

export async function GET(req: NextRequest) {
  try {
    await limiter.check(10, "vpu_users_api") // 10 requests per minute

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

    const [users, total] = await Promise.all([
      prisma.vpuUser.findMany({
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
      prisma.vpuUser.count({ where }),
    ])

    const usersWithDecryptedData = users.map((user) => ({
      ...user,
      username: decrypt(user._username),
      clientName: decrypt(user.client._name),
      client: undefined,
    }))

    return NextResponse.json({
      users: usersWithDecryptedData,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("Error fetching VPU users:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, "vpu_users_create_api") // 5 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = vpuUserSchema.parse(body)

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const vpuUser = await prisma.vpuUser.create({
      data: {
        clientId: validatedData.clientId,
        _username: encrypt(validatedData.username),
      },
    })

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "VPU_USER",
      entityId: vpuUser.id,
      oldValues: null,
      newValues: {
        clientId: validatedData.clientId,
        username: validatedData.username,
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json({
      id: vpuUser.id,
      clientId: vpuUser.clientId,
      username: validatedData.username,
      createdAt: vpuUser.createdAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error creating VPU user:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
