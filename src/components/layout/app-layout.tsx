
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
  SidebarProvider, 
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard,
  FileText,
  CalendarDays,
  GraduationCap,
  Settings,
  LogOut,
  Plane,
  Bell,
  Moon,
  Sun,
  ServerCog,
  SendHorizonal,
  LogIn,
  UserPlus,
  Loader2,
  Inbox, 
  ClipboardCheck, 
  FilePlus,
  Users,
  FileSignature
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context"; 
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/contexts/notification-context"; 
import { Breadcrumbs } from "./breadcrumbs"; 
import { HeaderClocks } from "@/components/features/header-clocks";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/requests", label: "Submit Request", icon: SendHorizonal },
  { href: "/my-requests", label: "My Requests", icon: Inbox }, 
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/my-alerts", label: "My Alerts", icon: Bell, id: "my-alerts-nav" },
  { type: "separator", key: "sep2" },
  { href: "/training", label: "Training Hub", icon: GraduationCap },
  { type: "separator", key: "sep3", adminOnly: true },
  { href: "/admin", label: "Admin Console", icon: ServerCog, adminOnly: true },
];

const useTheme = () => {
  const [theme, setTheme] = React.useState("light");
  React.useEffect(() => {
    const localTheme = typeof window !== "undefined" ? localStorage.getItem("theme") : "light";
    if (localTheme) {
      setTheme(localTheme);
      document.documentElement.classList.toggle("dark", localTheme === "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };
  return { theme, toggleTheme };
};


export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();
  const { unreadAlertsCount, isLoadingCount: isNotificationCountLoading } = useNotification();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
    }
  };

  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>; 
  }
  
  if (loading && !user) { 
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" aria-label="Loading application state" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <LayoutWithSidebar 
        user={user} 
        handleLogout={handleLogout} 
        theme={theme} 
        toggleTheme={toggleTheme}
        unreadAlertsCount={unreadAlertsCount}
        isNotificationCountLoading={isNotificationCountLoading}
      >
        {children}
      </LayoutWithSidebar>
    </SidebarProvider>
  );
}

function LayoutWithSidebar({ 
  children, 
  user, 
  handleLogout, 
  theme, 
  toggleTheme,
  unreadAlertsCount,
  isNotificationCountLoading
}: { 
  children: React.ReactNode; 
  user: any; 
  handleLogout: () => void; 
  theme: string; 
  toggleTheme: () => void;
  unreadAlertsCount: number;
  isNotificationCountLoading: boolean;
}) {
  const { isMobile } = useSidebar(); 
  const pathname = usePathname();

  const adminNavItems = [
    { href: "/admin", label: "Admin Console", icon: ServerCog },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/documents", label: "Document Management", icon: FilePlus }, 
    { href: "/admin/alerts", label: "Alert Management", icon: Bell },
    { href: "/admin/courses", label: "Course Management", icon: GraduationCap },
    { href: "/admin/user-requests", label: "User Requests", icon: ClipboardCheck },
    { href: "/admin/purser-reports", label: "Purser Reports Review", icon: FileSignature },
    { href: "/admin/flights", label: "Flight Management", icon: Plane },
    { href: "/admin/system-settings", label: "System Settings", icon: Settings },
  ];

  const currentNavItems = pathname.startsWith('/admin') && user?.role === 'admin' ? adminNavItems : navItems;


  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
        <SidebarHeader className="h-16 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary transition-colors">
            <Plane className="w-8 h-8 text-sidebar-primary" />
            <span className="font-bold text-xl group-data-[collapsible=icon]:hidden">AirCrew Hub</span>
          </Link>
        </SidebarHeader>
        <Separator />
        <SidebarContent className="p-2">
          <SidebarMenu>
            {currentNavItems.map((item) => {
              if (item.type === "separator") {
                if (item.adminOnly && user?.role !== 'admin' && !pathname.startsWith('/admin')) return null; 
                return <Separator key={item.key} className="my-2" />;
              }
              
              if (item.adminOnly && user?.role !== 'admin' && !pathname.startsWith('/admin')) { 
                return null; 
              }
              const isActive = item.href && (pathname === item.href || 
                               (item.href !== "/" && pathname.startsWith(item.href + '/')) ||
                               (item.href === "/admin" && pathname.startsWith("/admin/")));

              return (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href!} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      isActive={!!isActive}
                      tooltip={{ children: item.label, side: "right", align: "center" }}
                      className={cn(
                        "justify-start",
                        isActive && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                      )}
                    >
                      <a>
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                         {item.id === "my-alerts-nav" && user && unreadAlertsCount > 0 && (
                          <SidebarMenuBadge className="ml-auto bg-destructive text-destructive-foreground">
                            {isNotificationCountLoading ? <Loader2 className="h-3 w-3 animate-spin"/> : unreadAlertsCount}
                          </SidebarMenuBadge>
                        )}
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
        <Separator />
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
               <Link href="/settings" passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/settings"}
                  tooltip={{ children: "Settings", side: "right", align: "center" }}
                   className={cn(
                      "justify-start",
                      pathname === "/settings" && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                    )}
                >
                  <a>
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </a>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-4 md:px-6">
          {isMobile && <SidebarTrigger aria-label="Toggle sidebar" />}
          <div className="flex-1 flex items-center">
             <Breadcrumbs />
          </div>
          <div className="flex items-center gap-3">
            <HeaderClocks />
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}>
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            {user && (
              <Button variant="ghost" size="icon" aria-label="View notifications" asChild className="relative">
                <Link href="/my-alerts">
                  <Bell className="h-5 w-5" />
                  {unreadAlertsCount > 0 && (
                    <Badge 
                        variant="destructive" 
                        className="absolute -top-1 -right-1 h-4 w-4 min-w-4 p-0 flex items-center justify-center text-xs leading-none rounded-full"
                    >
                      {isNotificationCountLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin"/> : unreadAlertsCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="Open user menu">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.photoURL || "https://placehold.co/100x100.png"} alt="User Avatar" data-ai-hint="user avatar" />
                    <AvatarFallback>{user?.email ? user.email.substring(0, 2).toUpperCase() : "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <DropdownMenuLabel>
                      <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      {user.role && <p className="text-xs leading-none text-muted-foreground capitalize">Role: {user.role}</p>}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center w-full">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                       <Link href="/login" className="flex items-center w-full">
                        <LogIn className="mr-2 h-4 w-4" />
                        <span>Login</span>
                      </Link>
                    </DropdownMenuItem>
                     <DropdownMenuItem asChild>
                       <Link href="/signup" className="flex items-center w-full">
                        <UserPlus className="mr-2 h-4 w-4" />
                        <span>Sign Up</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
