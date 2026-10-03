"use client";

import { LoginForm } from "@/components/auth/login-form";
import { useWorkspacePaths } from "@/hooks/use-workspace-paths";

export default function EmployeeLoginPage() {
  const { employeePath } = useWorkspacePaths();

  return (
    <LoginForm
      type="employee"
      title="Employee sign in"
      subtitle="Punch in, apply for leave and download your payslips."
      redirectPath={employeePath("/employee/dashboard")}
      registerPath={employeePath("/employee/register")}
    />
  );
}
