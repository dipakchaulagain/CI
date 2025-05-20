import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { decrypt } from "@/lib/encryption"

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

const privateNetworkSchema = z.object({
  clientId: z.number().int().positive(),
  network: z.string().regex(/^([0-9]{1,3}\.){3}[0-9]{1,3}\/[0-9]{1,2}$/, "Invalid CIDR notation"),
  type: z.enum(["POOL", "SINGLE"]),
})

export async function GET(req: NextRequest) {
  try {
    await limiter.check(10, "private_networks_api") // 10 requests per minute

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

    const [networks, total] = await Promise.all([
      prisma.privateNetwork.findMany({
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
      prisma.privateNetwork.count({ where }),
    ])

    const networksWithClientName = networks.map((network) => ({
      ...network,
      clientName: decrypt(network.client._name),
      client: undefined,
    }))

    return NextResponse.json({
      networks: networksWithClientName,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("Error fetching private networks:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, "private_networks_create_api") // 5 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = privateNetworkSchema.parse(body)

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const network = await prisma.privateNetwork.create({
      data: {
        clientId: validatedData.clientId,
        network: validatedData.network,
        type: validatedData.type,
      },
    })

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "PRIVATE_NETWORK",
      entityId: network.id,
      oldValues: null,
      newValues: {
        clientId: validatedData.clientId,
        network: validatedData.network,
        type: validatedData.type,
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json(network)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error creating private network:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
