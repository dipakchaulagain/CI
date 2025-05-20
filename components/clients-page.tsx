"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Building2, Edit, Eye, MoreHorizontal, Plus, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientDialog } from "@/components/client-dialog"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { useToast } from "@/hooks/use-toast"

type Client = {
  id: number
  name: string
  primaryContact: string
  secondaryContact: string | null
  status: "ONBOARD" | "TRIAL" | "TERMINATED"
  remarks: string
  createdAt: string
  updatedAt: string
}

type PaginationData = {
  total: number
  pages: number
  page: number
  limit: number
}

export function ClientsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const [clients, setClients] = useState<Client[]>([])
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    pages: 0,
    page: 1,
    limit: 10,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null)

  const isAdmin = session?.user?.isAdmin

  useEffect(() => {
    fetchClients()
  }, [pagination.page, searchQuery, statusFilter])

  async function fetchClients() {
    setIsLoading(true)
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchQuery) {
        queryParams.append("search", searchQuery)
      }

      if (statusFilter) {
        queryParams.append("status", statusFilter)
      }

      const response = await fetch(`/api/clients?${queryParams.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setClients(data.clients)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching clients:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to fetch clients. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  function handleEditClient(client: Client) {
    setSelectedClient(client)
    setClientDialogOpen(true)
  }

  function handleDeleteClient(client: Client) {
    setClientToDelete(client)
    setDeleteDialogOpen(true)
  }

  async function confirmDeleteClient() {
    if (!clientToDelete) return

    try {
      const response = await fetch(`/api/clients/${clientToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Client Deleted",
          description: `${clientToDelete.name} has been deleted successfully.`,
        })
        fetchClients()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete client")
      }
    } catch (error) {
      console.error("Error deleting client:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete client. Please try again.",
      })
    } finally {
      setDeleteDialogOpen(false)
      setClientToDelete(null)
    }
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case "ONBOARD":
        return "bg-green-100 text-green-800"
      case "TRIAL":
        return "bg-yellow-100 text-yellow-800"
      case "TERMINATED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Manage your client organizations</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setSelectedClient(null)
              setClientDialogOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value="ONBOARD">Onboard</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="TERMINATED">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Building2 className="mb-4 h-12 w-12 text-muted-foreground" />
            <CardTitle className="mb-2">No Clients Found</CardTitle>
            <CardDescription>
              {searchQuery || statusFilter
                ? "Try adjusting your search or filter criteria"
                : "Get started by adding your first client"}
            </CardDescription>
            {isAdmin && !searchQuery && !statusFilter && (
              <Button
                className="mt-4"
                onClick={() => {
                  setSelectedClient(null)
                  setClientDialogOpen(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{client.name}</CardTitle>
                    <CardDescription>Added on {new Date(client.createdAt).toLocaleDateString()}</CardDescription>
                  </div>
                  <div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                        client.status,
                      )}`}
                    >
                      {client.status}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Primary Contact:</span> {client.primaryContact}
                  </div>
                  {client.secondaryContact && (
                    <div>
                      <span className="font-medium">Secondary Contact:</span> {client.secondaryContact}
                    </div>
                  )}
                  {client.remarks && (
                    <div>
                      <span className="font-medium">Remarks:</span> {client.remarks}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push(`/clients/${client.id}`)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClient(client)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteClient(client)}>
                          <Trash className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === 1}
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {pagination.page} of {pagination.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page === pagination.pages}
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
          >
            Next
          </Button>
        </div>
      )}

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        client={selectedClient}
        onSuccess={fetchClients}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Client"
        description={`Are you sure you want to delete ${clientToDelete?.name}? This action cannot be undone and will also delete all associated projects, networks, and VPU users.`}
        onConfirm={confirmDeleteClient}
      />
    </div>
  )
}
