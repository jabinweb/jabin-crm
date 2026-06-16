import { UserRole, UserStatus } from '../enums';

export interface AuthToken {
  id: number;
  employeeId?: string;
  email: string;
  role: UserRole;
  companyId: number;
  status: UserStatus;
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  user: AuthUser;
  token?: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  employeeId?: string;
  companyId: number;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}