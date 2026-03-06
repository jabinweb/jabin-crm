import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      image?: string
      role: string
      customerId?: string
    }
    accessToken?: string
    error?: string
  }

  interface User {
    role: string
    customerId?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: string
    customerId?: string
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
    error?: string
  }
}