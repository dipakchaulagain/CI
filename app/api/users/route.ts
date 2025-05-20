import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createAuditLog } from "@/lib/audit"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { hash } from "bcrypt"
import { encrypt } from "@/lib/encryption"
import { generateMfaSecret } from "@/lib/mfa"

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

const userSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(8),
  isAdmin: z.boolean().default(false),
  mfaEnabled: z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  try {
    await limiter.check(10, "users_api") // 10 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          isAdmin: true,
          mfaEnabled: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count(),
    ])

    return NextResponse.json({
      users,
      pagination: {
        total,
        pages: Math.ceil(total / limit),
        page,
        limit,
      },
    })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await limiter.check(5, "users_create_api") // 5 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validatedData = userSchema.parse(body)

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: validatedData.username },
    })

    if (existingUser) {
      return NextResponse.json({ error: "Username already exists" }, { status: 400 })
    }

    // Hash password
    const hashedPassword = await hash(validatedData.password, 10)

    const newUser = await prisma.user.create({
      data: {
        username: validatedData.username,
        passwordHash: hashedPassword,
        isAdmin: validatedData.isAdmin,
        mfaEnabled: validatedData.mfaEnabled,
        mfaSecret: validatedData.mfaEnabled ? encrypt(generateMfaSecret()) : null,
      },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "USER",
      entityId: newUser.id,
      oldValues: null,
      newValues: {
        username: validatedData.username,
        isAdmin: validatedData.isAdmin,
        mfaEnabled: validatedData.mfaEnabled,
      },
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json(newUser)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
