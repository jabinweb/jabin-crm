"use client"

import * as React from "react"
import { ArchiveX, File, Inbox, Send, Trash2, Mail } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { useWorkspacePaths } from "@/hooks/use-workspace-paths"

interface EmailSidebarProps extends React.ComponentProps<typeof Sidebar> {
  drafts: any[]
}

export function EmailSidebar({ drafts, ...props }: EmailSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { path } = useWorkspacePaths()
  const { setOpen } = useSidebar()
  const [showUnread, setShowUnread] = React.useState(false)

  const navMain = React.useMemo(
    () => [
      {
        title: "All Drafts",
        url: path("/dashboard/emails/drafts"),
        icon: Inbox,
        isActive: pathname === path("/dashboard/emails/drafts"),
      },
      {
        title: "Sent",
        url: path("/dashboard/emails/sent"),
        icon: Send,
        isActive: pathname === path("/dashboard/emails/sent"),
      },
      {
        title: "Campaigns",
        url: path("/dashboard/campaigns"),
        icon: Mail,
        isActive: pathname === path("/dashboard/campaigns"),
      },
      {
        title: "Trash",
        url: path("/dashboard/emails/trash"),
        icon: Trash2,
        isActive: pathname === path("/dashboard/emails/trash"),
      },
    ],
    [path, pathname]
  )

  const [filteredDrafts, setFilteredDrafts] = React.useState(drafts)
  const [activeItem, setActiveItem] = React.useState(navMain[0])

  React.useEffect(() => {
    setFilteredDrafts(drafts)
  }, [drafts])

  React.useEffect(() => {
    const match = navMain.find((item) => item.isActive)
    if (match) setActiveItem(match)
  }, [navMain])

  const handleSearch = (value: string) => {
    if (!value) {
      setFilteredDrafts(drafts)
      return
    }
    const filtered = drafts.filter(
      (draft) =>
        draft.companyName?.toLowerCase().includes(value.toLowerCase()) ||
        draft.subject?.toLowerCase().includes(value.toLowerCase()) ||
        draft.recipientEmail?.toLowerCase().includes(value.toLowerCase())
    )
    setFilteredDrafts(filtered)
  }

  return (
    <Sidebar
      collapsible="icon"
      className="overflow-hidden [&>[data-sidebar=sidebar]]:flex-row"
      {...props}
    >
      {/* Navigation Sidebar */}
      <Sidebar
        collapsible="none"
        className="!w-[calc(var(--sidebar-width-icon)_+_1px)] border-r"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
                <div className="flex aspect-square size-8 items-center justify-center rounded-none bg-sidebar-primary text-sidebar-primary-foreground">
                  <Mail className="size-4" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent className="px-1.5 md:px-0">
              <SidebarMenu>
                {navMain.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={{
                        children: item.title,
                        hidden: false,
                      }}
                      onClick={() => {
                        setActiveItem(item)
                        router.push(item.url)
                        setOpen(true)
                      }}
                      isActive={item.isActive}
                      className="px-2.5 md:px-2"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {/* Drafts List Sidebar */}
      <Sidebar collapsible="none" className="hidden flex-1 md:flex">
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              {activeItem?.title || "All Drafts"}
            </div>
            <Label className="flex items-center gap-2 text-sm">
              <span>Unsent</span>
              <Switch 
                className="shadow-none" 
                checked={showUnread}
                onCheckedChange={setShowUnread}
              />
            </Label>
          </div>
          <SidebarInput 
            placeholder="Search drafts..." 
            onChange={(e) => handleSearch(e.target.value)}
          />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup className="px-0">
            <SidebarGroupContent>
              {filteredDrafts.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No drafts found
                </div>
              ) : (
                filteredDrafts.map((draft) => (
                  <a
                    href={`#draft-${draft.id}`}
                    key={draft.id}
                    className="flex flex-col items-start gap-2 whitespace-nowrap border-b p-4 text-sm leading-tight last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <div className="flex w-full items-center gap-2">
                      <span className="font-medium">{draft.companyName}</span>
                      <span className="ml-auto text-xs">
                        {new Date(draft.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-medium text-xs">{draft.subject}</span>
                    <span className="line-clamp-2 w-[260px] whitespace-break-spaces text-xs text-muted-foreground">
                      {draft.recipientEmail || "No recipient"}
                    </span>
                  </a>
                ))
              )}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </Sidebar>
  )
}
