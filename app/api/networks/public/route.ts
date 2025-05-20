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

const publicIpSchema = z.object({
  clientId: z.number().int().positive(),
  ipAddress: z.string().regex(/^([0-9]{1,3}\.){3}[0-9]{1,3}$/, "Invalid IP address"),
})

export async function GET(req: NextRequest) {
  try {
    await limiter.check(10, "public_ips_api") // 10 requests per minute

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

    const [ips, total] = await Promise.all([
      prisma.publicIp.findMany({
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
      prisma.publicIp.count({ where }),
    ])

    const ipsWithClientName = ips.map((ip) => ({
      ...ip,
      clientName: decrypt(ip.client._name),
      client: undefined,
    }))

    return NextResponse.json({
      ips: ipsWithClientName,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("Error fetching public IPs:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, "public_ips_create_api") // 5 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = publicIpSchema.parse(body)

    // Check if client exists
    const client = await prisma.client.findUnique({
      where: { id: validatedData.clientId },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const ip = await prisma.publicIp.create({
      data: {
        clientId: validatedData.clientId,
        ipAddress: validatedData.ipAddress,
      },
    })

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "PUBLIC_IP",
      entityId: ip.id,
      oldValues: null,
      newValues: {
        clientId: validatedData.clientId,
        ipAddress: validatedData.ipAddress,
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json(ip)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error creating public IP:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
