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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await limiter.check(20, "client_detail_api") // 20 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const client = await prisma.client.findUnique({
      where: { id: Number.parseInt(params.id) },
      include: {
        projects: true,
        privateNetworks: true,
        publicIps: true,
        vpuUsers: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const decryptedClient = {
      ...client,
      name: decrypt(client._name),
      primaryContact: decrypt(client._primaryContact),
      secondaryContact: client._secondaryContact ? decrypt(client._secondaryContact) : null,
      vpuUsers: client.vpuUsers.map((user) => ({
        ...user,
        username: decrypt(user._username),
      })),
    }

    return NextResponse.json(decryptedClient)
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await limiter.check(5, "client_update_api") // 5 requests per minute

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

    const existingClient = await prisma.client.findUnique({
      where: { id: Number.parseInt(params.id) },
    })

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    const oldValues = {
      name: decrypt(existingClient._name),
      primaryContact: decrypt(existingClient._primaryContact),
      secondaryContact: existingClient._secondaryContact ? decrypt(existingClient._secondaryContact) : null,
      status: existingClient.status,
      remarks: existingClient.remarks,
    }

    const updatedClient = await prisma.client.update({
      where: { id: Number.parseInt(params.id) },
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
      action: "UPDATE",
      entityType: "CLIENT",
      entityId: updatedClient.id,
      oldValues,
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
      id: updatedClient.id,
      name: validatedData.name,
      primaryContact: validatedData.primaryContact,
      secondaryContact: validatedData.secondaryContact,
      status: validatedData.status,
      remarks: validatedData.remarks,
      createdAt: updatedClient.createdAt,
      updatedAt: updatedClient.updatedAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }

    console.error("Error updating client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await limiter.check(3, "client_delete_api") // 3 requests per minute

    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { user } = session
    if (!user.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const existingClient = await prisma.client.findUnique({
      where: { id: Number.parseInt(params.id) },
    })

    if (!existingClient) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Delete related records first
    await prisma.$transaction([
      prisma.project.deleteMany({ where: { clientId: Number.parseInt(params.id) } }),
      prisma.privateNetwork.deleteMany({ where: { clientId: Number.parseInt(params.id) } }),
      prisma.publicIp.deleteMany({ where: { clientId: Number.parseInt(params.id) } }),
      prisma.vpuUser.deleteMany({ where: { clientId: Number.parseInt(params.id) } }),
      prisma.client.delete({ where: { id: Number.parseInt(params.id) } }),
    ])

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "CLIENT",
      entityId: Number.parseInt(params.id),
      oldValues: {
        name: decrypt(existingClient._name),
        primaryContact: decrypt(existingClient._primaryContact),
        secondaryContact: existingClient._secondaryContact ? decrypt(existingClient._secondaryContact) : null,
        status: existingClient.status,
        remarks: existingClient.remarks,
      },
      newValues: null,
      ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting client:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
