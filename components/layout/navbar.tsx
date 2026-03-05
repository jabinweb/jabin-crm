'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
import { Activity, LogOut, Settings, User, Crown, CreditCard, Search, Building2, Mail, Phone, ClipboardList, Stethoscope } from 'lucide-react';

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
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
        const response = await fetch(`/api/leads?search=${encodeURIComponent(searchQuery)}&limit=10`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.leads || []);
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
    router.push(`/dashboard/leads/${leadId}`);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-3 sm:px-4 lg:px-8">
        <div className="mr-2 sm:mr-4 flex md:hidden">
          <a className="flex items-center space-x-2" href="/dashboard">
            <Stethoscope className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </a>
        </div>

        <div className="mr-4 hidden md:flex">
          <a className="mr-6 flex items-center space-x-2" href="/dashboard">
            <Stethoscope className="h-6 w-6 text-blue-600" />
            <span className="hidden font-bold lg:inline-block">Jabin CRM</span>
          </a>
        </div>

        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <Button
              variant="outline"
              className="relative h-9 w-full justify-start px-3 py-2 text-sm sm:w-64 md:w-auto lg:w-64"
              onClick={() => setOpen(true)}
            >
              <Search className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline-flex flex-1 text-left">Search customers, tickets...</span>
              <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 ml-auto">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
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
                  <Badge variant="secondary" className="w-fit mt-1 text-xs">
                    {session?.user?.role}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {session?.user?.role === 'admin' && (
                <>
                  <DropdownMenuItem asChild>
                    <a href="/admin">
                      <Crown className="mr-2 h-4 w-4 text-red-600" />
                      <span className="text-red-600 font-semibold">Admin Panel</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem asChild>
                <a href="/dashboard/settings/subscription">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Subscription</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/pricing">
                  <Crown className="mr-2 h-4 w-4" />
                  <span>Upgrade Plan</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href="/dashboard/settings">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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