'use client'

import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation'
import { 
  Search,
  MessageSquare,
  Settings,
  LogOut,
  User,
  Menu,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NotificationsPanel } from '@/components/notifications/notifications-panel'
import Link from 'next/link'
import { QuickActions } from './quick-actions'
import { useWorkspacePaths } from '@/hooks/use-workspace-paths'
import { useUnreadMessages } from '@/components/messaging/use-messaging'

interface TopBarProps {
  showSearch?: boolean
  showNotifications?: boolean
  showMessages?: boolean
  onSearch?: (query: string) => void
  title?: string | React.ReactNode
  mobileMenu?: React.ReactNode
  userRole: string
  menuItems?: {
    label: string
    icon: React.ReactNode
    onClick: () => void
  }[]
  navigationItems?: {
    href: string
    label: string
    icon: React.ReactNode
  }[]
  profileOptions?: {
    label: string
    icon: React.ReactNode
    onClick: () => void
  }[]
}

export function TopBar({
  showSearch = true,
  showNotifications = true,
  showMessages = true,
  onSearch,
  title,
  userRole,
  navigationItems = [],
  profileOptions = [],
}: TopBarProps) {
  const router = useRouter()
  const { data: session } = useSession();
  const { path, employeePath, slug } = useWorkspacePaths()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const { data: unreadMessages = 0 } = useUnreadMessages(showMessages && !!session?.user)

  const defaultProfileOptions = [
    {
      label: 'Profile',
      icon: <User className="mr-2 h-4 w-4" />,
      onClick: () => {
        if (!slug) return
        if (userRole === 'EMPLOYEE') {
          router.push(employeePath('/employee/profile'))
        } else {
          router.push(path('/dashboard/settings'))
        }
      },
    },
    {
      label: 'Settings',
      icon: <Settings className="mr-2 h-4 w-4" />,
      onClick: () => {
        if (!slug) return
        if (userRole === 'EMPLOYEE') {
          router.push(employeePath('/employee/profile'))
        } else {
          router.push(path('/dashboard/settings'))
        }
      },
    },
    {
      label: 'Log out',
      icon: <LogOut className="mr-2 h-4 w-4" />,
      onClick: () => signOut()
    }
  ]

  const allProfileOptions = [...profileOptions, ...defaultProfileOptions]

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4">
        {/* Mobile Menu with custom items */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Hello, {session?.user?.name}</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
              {navigationItems.map((item, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  className="w-full justify-start mb-1"
                  asChild
                >
                  <Link href={item.href}>
                    {item.icon}
                    {item.label}
                  </Link>
                </Button>
              ))}
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Title/Logo */}
        <div className="hidden md:flex ml-4">
          <h2 className="text-lg font-semibold">
            Hello, {session?.user?.name}
          </h2>
        </div>

        <div className="flex flex-1 items-center justify-end space-x-4">
          {/* Search */}
          {showSearch && (
            <div className={cn(
              "transition-all duration-300",
              isSearchOpen ? "w-full md:w-1/2" : "w-auto"
            )}>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className={cn(
                    "pl-8",
                    isSearchOpen ? "w-full" : "w-[150px] md:w-[250px]"
                  )}
                  onFocus={() => setIsSearchOpen(true)}
                  onBlur={() => setIsSearchOpen(false)}
                  onChange={(e) => onSearch?.(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Quick Actions - only show for admin/manager */}
          {(userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'SUPPORT_MANAGER') && (
            <QuickActions />
          )}

          {/* Notifications */}
          {showNotifications && <NotificationsPanel userRole={userRole} />}

          {/* Messages */}
          {showMessages && (
            <Button variant="ghost" size="icon" className="relative" asChild>
              <Link
                href={
                  userRole === 'EMPLOYEE'
                    ? employeePath('/employee/messages')
                    : path('/dashboard/messages')
                }
                aria-label={unreadMessages ? `Messages, ${unreadMessages} unread` : 'Messages'}
              >
                <MessageSquare className="h-5 w-5" />
                {unreadMessages ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                ) : null}
              </Link>
            </Button>
          )}

          {/* Customizable Profile Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-none">
                <UserAvatar person={session?.user} size="md" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {allProfileOptions.map((option, index) => (
                  <DropdownMenuItem key={index} onClick={option.onClick}>
                    {option.icon}
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

