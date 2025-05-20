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

const clientSchema = z.object({
  name: z.string().min(1),
  primaryContact: z.string().min(1),
  secondaryContact: z.string().optional(),
  status: z.enum(["ONBOARD", "TRIAL", "TERMINATED"]),
  remarks: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await limiter.check(10, "clients_api") // 10 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")
    const status = searchParams.get("status")
    const search = searchParams.get("search")

    const skip = (page - 1) * limit

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (search) {
      where.OR = [
        { _name: { contains: search, mode: "insensitive" } },
        { _primaryContact: { contains: search, mode: "insensitive" } },
      ]
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.count({ where }),
    ])

    const decryptedClients = clients.map((client) => ({
      ...client,
      name: decrypt(client._name),
      primaryContact: decrypt(client._primaryContact),
      secondaryContact: client._secondaryContact ? decrypt(client._secondaryContact) : null,
    }))

    return NextResponse.json({
      clients: decryptedClients,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("Error fetching clients:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, "clients_create_api") // 5 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = clientSchema.parse(body)

    const client = await prisma.client.create({
      data: {
        _name: encrypt(validatedData.name),
        _primaryContact: encrypt(validatedData.primaryContact),
        _secondaryContact: validatedData.secondaryContact ? encrypt(validatedData.secondaryContact) : null,
        status: validatedData.status,
        remarks: validatedData.remarks || "",
      },
    })

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "CLIENT",
      entityId: client.id,
      oldValues: null,
      newValues: {
        name: validatedData.name,
        primaryContact: validatedData.primaryContact,
        secondaryContact: validatedData.secondaryContact,
        status: validatedData.status,
        remarks: validatedData.remarks,
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json({
      id: client.id,
      name: validatedData.name,
      primaryContact: validatedData.primaryContact,
      secondaryContact: validatedData.secondaryContact,
      status: validatedData.status,
      remarks: validatedData.remarks,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error creating client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
