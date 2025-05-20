"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  totpCode: z.string().optional(),
})

export function LoginForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [showMfa, setShowMfa] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
      totpCode: "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        username: values.username,
        password: values.password,
        totpCode: values.totpCode,
        redirect: false,
      })

      if (result?.error === "MFA_REQUIRED") {
        setShowMfa(true)
        toast({
          title: "MFA Required",
          description: "Please enter your MFA code to continue",
        })
      } else if (result?.error === "INVALID_MFA_CODE") {
        toast({
          variant: "destructive",
          title: "Invalid MFA Code",
          description: "The MFA code you entered is invalid. Please try again.",
        })
      } else if (result?.error) {
        toast({
          variant: "destructive",
          title: "Authentication Failed",
          description: "Invalid username or password. Please try again.",
        })
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: "An error occurred during login. Please try again.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mt-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="Enter your password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {showMfa && (
            <FormField
              control={form.control}
              name="totpCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MFA Code</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter your MFA code" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Form>
    </div>
  )
}
