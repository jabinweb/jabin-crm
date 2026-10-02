"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ChevronLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";
import { workspaceSlugHeaders } from "@/lib/api/workspace-slug";
import AddressForm from "@/components/ui/address";

const employeeFormSchema = z.object({
  name: z.string().trim().min(2, "Enter the employee’s full name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || v.replace(/\D/g, "").length >= 7, "Enter a valid phone number"),
  // Address is optional; the API stores whatever is provided.
  address: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    zipCode: z.string(),
    country: z.string(),
  }),
  jobTitle: z.string().trim().min(2, "Enter a job title"),
  department: z.string().trim().min(2, "Enter a department"),
  departmentId: z.string().optional(),
  designationId: z.string().optional(),
  branchId: z.string().optional(),
  managerId: z.string().optional(),
  dateJoined: z.string().min(1, "Choose a joining date"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;
type OrgOption = { id: string; name: string };

export default function NewEmployeePage() {
  const router = useRouter();
  const params = useParams<{ company: string }>();
  const { path, slug } = useWorkspacePaths();
  const [departments, setDepartments] = useState<OrgOption[]>([]);
  const [designations, setDesignations] = useState<OrgOption[]>([]);
  const [branches, setBranches] = useState<OrgOption[]>([]);
  const [managers, setManagers] = useState<OrgOption[]>([]);
  const listHref = path("/dashboard/employees");

  const form = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
      },
      jobTitle: "",
      department: "General",
      departmentId: "",
      designationId: "",
      branchId: "",
      managerId: "",
      dateJoined: format(new Date(), "yyyy-MM-dd"),
    },
  });

  useEffect(() => {
    const headers = workspaceSlugHeaders(slug ?? params.company);
    void Promise.all([
      fetch("/api/hr/departments").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/hr/designations").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/hr/branches").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/employees", { headers }).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([deps, desigs, brs, emps]) => {
        setDepartments(Array.isArray(deps) ? deps : []);
        setDesignations(Array.isArray(desigs) ? desigs : []);
        setBranches(Array.isArray(brs) ? brs : []);
        const list = Array.isArray(emps) ? emps : emps?.data || [];
        setManagers(
          list.map((e: { id: string; name: string }) => ({
            id: e.id,
            name: e.name,
          }))
        );
      })
      .catch(() => {
        // Pickers stay empty; the form still works with free-text fields.
      });
  }, [slug, params.company]);

  const onSubmit = async (data: EmployeeFormData) => {
    const address = Object.values(data.address).some((v) => v.trim()) ? data.address : undefined;
    try {
      const response = await fetch("/api/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...workspaceSlugHeaders(slug ?? params.company),
        },
        body: JSON.stringify({
          ...data,
          address,
          departmentId: data.departmentId || null,
          designationId: data.designationId || null,
          branchId: data.branchId || null,
          managerId: data.managerId || null,
          dateJoined: new Date(data.dateJoined).toISOString(),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        toast({ title: "Employee added", description: `${data.name} has been added.` });
        router.push(listHref);
      } else {
        toast({
          title: "Couldn’t add employee",
          description: result.error || "Please check the details and try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Couldn’t add employee",
        description: "Check your connection and try again.",
        variant: "destructive",
      });
    }
  };

  const orgSelect = (
    name: "departmentId" | "designationId" | "branchId" | "managerId",
    label: string,
    options: OrgOption[],
    onPicked?: (opt: OrgOption | undefined) => void
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value || "none"}
            onValueChange={(v) => {
              const id = v === "none" ? "" : v;
              field.onChange(id);
              onPicked?.(options.find((o) => o.id === id));
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {options.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const submitting = form.formState.isSubmitting;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={listHref}
          className="mb-2 inline-flex min-h-[2.5rem] items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to employees
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add employee</h1>
        <p className="text-sm text-muted-foreground">
          Create an employee record. Only name, email, job title and joining date are required.
        </p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Priya Sharma" autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work email</FormLabel>
                    <FormControl>
                      <Input type="email" inputMode="email" autoComplete="off" placeholder="priya@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone (optional)</FormLabel>
                    <FormControl>
                      <Input type="tel" inputMode="tel" autoComplete="off" placeholder="+91 98765 43210" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role</CardTitle>
              <CardDescription>
                Pick from your departments, designations and branches, or leave as None.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {orgSelect("departmentId", "Department", departments, (o) => {
                if (o) form.setValue("department", o.name, { shouldValidate: true });
              })}
              {orgSelect("designationId", "Designation", designations, (o) => {
                if (o) form.setValue("jobTitle", o.name, { shouldValidate: true });
              })}
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title</FormLabel>
                    <FormControl>
                      <Input placeholder="Sales executive" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {departments.length === 0 && (
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department name</FormLabel>
                      <FormControl>
                        <Input placeholder="Sales" {...field} />
                      </FormControl>
                      <FormDescription>
                        <Link href={path("/dashboard/departments")} className="underline">
                          Set up departments
                        </Link>{" "}
                        to pick from a list instead.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {orgSelect("branchId", "Branch", branches)}
              {orgSelect("managerId", "Manager", managers)}
              <FormField
                control={form.control}
                name="dateJoined"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Joining date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Address (optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <AddressForm />
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" asChild>
              <Link href={listHref}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add employee
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
