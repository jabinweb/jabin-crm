"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { Chat } from "./chat";
import { ChatProvider } from '@/contexts/chat-context';
import { useMessageStore } from '@/lib/stores/message-store';
import { DEFAULT_AVATAR_SRC } from '@/lib/default-avatar';
import { useWorkspacePaths } from '@/hooks/use-workspace-paths';
import { useRealtime } from '@/hooks/use-realtime';
import { REALTIME_EVENTS } from '@/lib/realtime/events';

function resolveAvatar(src: string | null | undefined): string {
  if (!src || src === '/avatars/default.png') return DEFAULT_AVATAR_SRC;
  return src;
}

interface ChatLayoutProps {
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
}

export function ChatLayout({
  /** Percentages that sum to ~100 (not pixels). */
  defaultLayout = [32, 68],
  defaultCollapsed = false,
  navCollapsedSize,
}: ChatLayoutProps) {
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedChatItem, setSelectedChatItem] = React.useState<{
    id: string
    name: string
    avatar: string
  } | null>(null);
  

  const layout = React.useMemo(() => {
    const raw = defaultLayout?.length === 2 ? defaultLayout : [32, 68];
    const [a, b] = raw;
    // Cookie/layout must be percentage units (0–100). Legacy cookies stored px-like values.
    if (a > 100 || b > 100 || a + b > 110) {
      return [32, 68] as const;
    }
    return [a, b] as const;
  }, [defaultLayout]);

  const { workspaceFetch, slug } = useWorkspacePaths();
  const myId = session?.user?.id;
  const selectedIdRef = React.useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedChatItem?.id ?? null;
  }, [selectedChatItem?.id]);

  // Contacts = everyone in this workspace, most recent conversation first
  const fetchSortedContacts = React.useCallback(async () => {
    try {
      const response = await workspaceFetch('/api/chats/sorted-contacts');
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();

      const formattedContacts = data.map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        avatar: resolveAvatar(contact.avatar),
        unreadCount: contact.unreadCount ?? 0,
        lastMessage: contact.lastMessageContent ? {
          content: contact.lastMessageContent,
          timestamp: contact.lastMessageTimestamp,
          unread: contact.isUnread
        } : undefined
      }));

      useMessageStore.getState().setContacts(formattedContacts);

      setSelectedChatItem((current) => {
        if (current || formattedContacts.length === 0) return current;
        const first = formattedContacts[0];
        return { id: first.id, name: first.name, avatar: first.avatar };
      });
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  }, [workspaceFetch]);

  useEffect(() => {
    if (myId && slug) void fetchSortedContacts();
  }, [myId, slug, fetchSortedContacts]);

  // Incoming messages, pushed by POST /api/chats/[id]
  useRealtime({
    types: [REALTIME_EVENTS.DIRECT_MESSAGE],
    onEvent: (event) => {
      const data = event.payload as Record<string, string>;
      if (!myId || (data.receiverId !== myId && data.senderId !== myId)) return;
      const contactId = data.senderId === myId ? data.receiverId : data.senderId;
      useMessageStore.getState().addMessage(contactId, {
        id: data.id,
        content: data.content,
        senderId: data.senderId,
        receiverId: data.receiverId,
        timestamp: data.timestamp,
        createdAt: data.createdAt,
        status: 'SENT',
      });
      if (selectedIdRef.current === contactId) {
        void useMessageStore.getState().markAsRead(contactId);
      }
      void fetchSortedContacts();
    },
  });

  // Fallback when realtime is not connected: refresh the open conversation and the list
  useEffect(() => {
    if (!myId) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const open = selectedIdRef.current;
      if (open) void useMessageStore.getState().fetchMessages(open);
      void fetchSortedContacts();
    }, 20_000);
    return () => clearInterval(interval);
  }, [myId, fetchSortedContacts]);

  // Mobile responsiveness
  useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkScreenWidth();
    window.addEventListener("resize", checkScreenWidth);
    return () => window.removeEventListener("resize", checkScreenWidth);
  }, []);

  function handleSelectUser(user: { id: string; name: string; avatar: string }) {
    setSelectedChatItem(user);
    useMessageStore.getState().markAsRead(user.id).catch(error => {
      console.error('Failed to mark messages as read:', error);
    });
  }

  if (!session?.user) return null;

  const currentUser = session.user

  return (
    <ChatProvider 
      currentUser={{
        id: currentUser.id,
        name: currentUser.name!,
        avatar: resolveAvatar(currentUser.image)
      }}
    >
      <ResizablePanelGroup
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`;
        }}
        className="h-full items-stretch"
      >
        <ResizablePanel
          defaultSize={layout[0]}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          minSize={isMobile ? 0 : 24}
          maxSize={isMobile ? 8 : 30}
          onCollapse={() => {
            setIsCollapsed(true);
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`;
          }}
          onExpand={() => {
            setIsCollapsed(false);
            document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`;
          }}
          className={cn(
            isCollapsed && "min-w-[50px] md:min-w-[70px] transition-all duration-300 ease-in-out"
          )}
        >
          <Sidebar
            isCollapsed={isCollapsed || isMobile}
            onSelect={handleSelectUser}
            isMobile={isMobile}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={layout[1]} minSize={30}>
          {selectedChatItem && (
            <Chat
              selectedUser={selectedChatItem}
              isMobile={isMobile}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </ChatProvider>
  );
}
