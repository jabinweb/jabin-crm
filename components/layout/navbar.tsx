'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DashboardLink } from '@/components/navigation/dashboard-link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Activity, LogOut, Settings, User, Crown, CreditCard, Search, Building2, Mail, Phone, ClipboardList } from 'lucide-react';
import { workspaceSlugHeaders } from '@/lib/api/workspace-slug';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { resolvePostLoginPath } from '@/lib/auth/post-login-path';
import { getClientBrandConfig } from '@/lib/branding';
import { PunchButton } from '@/components/dashboard/punch-button';
import { NotificationsPanel } from '@/components/notifications/notifications-panel';

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const brand = getClientBrandConfig();
  const params = useParams<{ company?: string }>();
  const workspaceSlug =
    typeof params?.company === 'string'
      ? params.company
      : session?.user?.companySlug ?? undefined;
  const { path } = useWorkspacePaths();
  const homeHref = session?.user
    ? resolvePostLoginPath({
        role: session.user.role,
        companySlug: (session.user as { companySlug?: string }).companySlug,
      })
    : '/workspace';
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Open command menu with Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search leads when query changes
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchLeads = async () => {
      setSearching(true);
      try {
        const headers = workspaceSlug ? workspaceSlugHeaders(workspaceSlug) : undefined;
        const response = await fetch(
          `/api/leads?query=${encodeURIComponent(searchQuery)}&limit=10`,
          headers ? { headers } : undefined
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.data || data.leads || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(searchLeads, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSelectLead = (leadId: string) => {
    setOpen(false);
    router.push(path(`/dashboard/leads/${leadId}`));
  };

  return (
    <header className="z-50 w-full border-b bg-background shrink-0">
      <div className="flex h-14 items-center px-3 sm:px-4 lg:px-8">
        <div className="mr-2 sm:mr-4 flex md:hidden">
          <Link className="flex items-center space-x-2" href={homeHref}>
            <Building2 className="h-5 w-5 text-foreground" />
          </Link>
        </div>

        <div className="mr-4 hidden md:flex">
          <Link className="mr-6 flex items-center space-x-2" href={homeHref}>
            <Building2 className="h-5 w-5 text-foreground" />
            <span className="hidden font-semibold lg:inline-block tracking-tight">
              {brand.appName}
            </span>
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Button
              variant="outline"
              className="relative h-9 w-full justify-start px-3 text-sm font-normal text-muted-foreground sm:w-64 md:w-auto lg:w-72"
              onClick={() => setOpen(true)}
            >
              <Search className="h-4 w-4 sm:mr-2 shrink-0" />
              <span className="hidden sm:inline-flex flex-1 text-left truncate">
                Search employees, leads, customers…
              </span>
              <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto">
                ⌘K
              </kbd>
            </Button>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <PunchButton />
            {session?.user?.role && (
              <NotificationsPanel userRole={session.user.role} />
            )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session?.user?.image || ''} alt={session?.user?.name || ''} />
                  <AvatarFallback className="text-xs">
                    {session?.user?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none truncate">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {session?.user?.email}
                  </p>
                  <Badge variant="secondary" className="w-fit mt-1 capitalize">
                    {session?.user?.role?.replaceAll('_', ' ').toLowerCase()}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(session?.user?.role === 'SUPER_ADMIN' || session?.user?.role === 'ADMIN') && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href={session.user.role === 'SUPER_ADMIN' ? '/admin' : path('/dashboard')}>
                      <Crown className="mr-2 h-4 w-4" />
                      <span>
                        {session.user.role === 'SUPER_ADMIN' ? 'Platform admin' : 'Workspace home'}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {(session?.user?.role === 'ADMIN' ||
                session?.user?.role === 'SUPER_ADMIN') && (
                <>
                  <DropdownMenuItem asChild>
                    <DashboardLink href="/dashboard/settings/subscription">
                      <CreditCard className="mr-2 h-4 w-4" />
                      <span>Subscription</span>
                    </DashboardLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/pricing">
                      <Crown className="mr-2 h-4 w-4" />
                      <span>Upgrade plan</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <DashboardLink href="/dashboard/settings">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </DashboardLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <DashboardLink href="/dashboard/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DashboardLink>
                  </DropdownMenuItem>
                </>
              )}
              {!!session?.user?.employeeId &&
                session?.user?.role !== 'ADMIN' &&
                session?.user?.role !== 'SUPER_ADMIN' && (
                  <DropdownMenuItem asChild>
                    <Link
                      href={
                        workspaceSlug
                          ? `/${workspaceSlug}/employee/profile`
                          : path('/dashboard')
                      }
                    >
                      <User className="mr-2 h-4 w-4" />
                      <span>My profile</span>
                    </Link>
                  </DropdownMenuItem>
                )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Command Dialog for Lead Search */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search leads by company, email, or phone..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>
            {searching ? 'Searching...' : searchQuery.length < 2 ? 'Type at least 2 characters to search' : 'No leads found.'}
          </CommandEmpty>
          {searchResults.length > 0 && (
            <CommandGroup heading="Leads">
              {searchResults.map((lead) => (
                <CommandItem
                  key={lead.id}
                  onSelect={() => handleSelectLead(lead.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">{lead.companyName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </span>
                      )}
                      {lead.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {lead.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  {lead.status && (
                    <Badge variant="secondary" className="text-xs">
                      {lead.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </header>
  );
}
