import { CompanyStatus } from '../enums';

export interface Company {
  id: string;
  name: string;
  website: string;
  status: CompanyStatus;
  adminId?: string;
  logo?: string;
  createdAt: Date;
}

export interface CompanySearchResult {
  id: string;
  name: string;
}

export interface CompanyResponse {
  companies: CompanySearchResult[];
}
