"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  primaryContact: z.string().min(1, "Primary contact is required"),
  secondaryContact: z.string().optional(),
  status: z.enum(["ONBOARD", "TRIAL", "TERMINATED"]),
  remarks: z.string().optional(),
})

type ClientDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: {
    id: number
    name: string
    primaryContact: string
    secondaryContact: string | null
    status: "ONBOARD" | "TRIAL" | "TERMINATED"
    remarks: string
  } | null
  onSuccess: () => void
}

export function ClientDialog({ open, onOpenChange, client, onSuccess }: ClientDialogProps) {
  const { toast } = useToast()
  const isEditing = !!client

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      primaryContact: "",
      secondaryContact: "",
      status: "ONBOARD" as const,
      remarks: "",
    },
  })

  useEffect(() => {
    if (client) {
      form.reset({
        name: client.name,
        primaryContact: client.primaryContact,
        secondaryContact: client.secondaryContact || "",
        status: client.status,
        remarks: client.remarks || "",
      })
    } else {
      form.reset({
        name: "",
        primaryContact: "",
        secondaryContact: "",
        status: "ONBOARD" as const,
        remarks: "",
      })
    }
  }, [client, form])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const url = isEditing ? `/api/clients/${client.id}` : "/api/clients"
      const method = isEditing ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      })

      if (response.ok) {
        toast({
          title: isEditing ? "Client Updated" : "Client Created",
          description: isEditing
            ? `${values.name} has been updated successfully.`
            : `${values.name} has been added successfully.`,
        })
        onOpenChange(false)
        onSuccess()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to save client")
      }
    } catch (error) {
      console.error("Error saving client:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save client. Please try again.",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Client" : "Add New Client"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the client's information below." : "Fill in the details to add a new client."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Client Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter client name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="primaryContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter primary contact" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="secondaryContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Secondary Contact (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter secondary contact" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ONBOARD">Onboard</SelectItem>
                      <SelectItem value="TRIAL">Trial</SelectItem>
                      <SelectItem value="TERMINATED">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Enter any additional notes or remarks" className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{isEditing ? "Update Client" : "Add Client"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
