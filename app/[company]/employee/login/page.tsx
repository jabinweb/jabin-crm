"use client";

import { useParams } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";

export default function EmployeeLoginPage() {
  const { employeePath } = useWorkspacePaths();

  return (
    <LoginForm
      type="employee"
      title="Employee Login"
      subtitle="Sign in to your employee account"
      redirectPath={employeePath("/employee/dashboard")}
      registerPath={employeePath("/employee/register")}
    />
  );
}
