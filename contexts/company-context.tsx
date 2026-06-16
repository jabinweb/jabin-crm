'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface CompanyData {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: string;
  settings: Record<string, unknown> | null;
}

interface CompanyContextValue {
  company: CompanyData;
  /** Build a URL scoped to the active company: getCompanyUrl('/dashboard') → '/acme-corp/dashboard' */
  getCompanyUrl: (path: string) => string;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({
  company,
  children,
}: {
  company: CompanyData;
  children: ReactNode;
}) {
  const getCompanyUrl = (path: string) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/${company.slug}${cleanPath}`;
  };

  return (
    <CompanyContext.Provider value={{ company, getCompanyUrl }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error(
      'useCompany() must be used inside a <CompanyProvider>. ' +
      'This usually means you are rendering a company-scoped page outside of /[company]/.'
    );
  }
  return ctx;
}

export function useCompanyOptional(): CompanyContextValue | null {
  return useContext(CompanyContext);
}
