
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
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
  FileSignature,
  Brain,
  Calculator,
  Lightbulb,
  MessagesSquare,
  Wrench,
  CheckSquare,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context"; 
import { useToast } from "@/hooks/use-toast";
import { useNotification } from "@/contexts/notification-context"; 
import { Breadcrumbs } from "./breadcrumbs"; 
import { HeaderClocks } from "@/components/features/header-clocks";

const navItems = [
  // Core
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/my-alerts", label: "My Alerts", icon: Bell, id: "my-alerts-nav" },

  // Learning & Reference
  { href: "/training", label: "Training Hub", icon: GraduationCap },
  { href: "/documents", label: "Documents", icon: FileText },

  // Actions & Communication
  { href: "/requests", label: "My Requests", icon: Inbox },
  { href: "/purser-reports", label: "Purser Reports", icon: FileSignature },
  { href: "/crew-community", label: "Crew Community", icon: MessagesSquare },
  { href: "/suggestion-box", label: "Suggestion Box", icon: Lightbulb },
  
  // Tools
  { href: "/airport-briefings", label: "Airport Briefing", icon: Brain },
  { href: "/flight-duty-calculator", label: "Duty Calculator", icon: Calculator },
  { href: "/toolbox", label: "Toolbox", icon: Wrench },
  
  // Admin
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
  const { unreadAlertsCount, isLoading: isNotificationCountLoading } = useNotification();

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
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/user-requests", label: "Requests", icon: ClipboardCheck },
    { href: "/admin/documents", label: "Documents", icon: FilePlus },
    { href: "/admin/alerts", label: "Alerts", icon: Bell },
    { href: "/admin/courses", label: "Courses", icon: GraduationCap },
    { href: "/admin/quizzes", label: "Quizzes", icon: CheckSquare },
    { href: "/admin/flights", label: "Flights", icon: Plane },
    { href: "/admin/purser-reports", label: "Purser Reports", icon: FileSignature },
    { href: "/admin/suggestions", label: "Suggestions", icon: MessageSquare },
    { href: "/admin/system-settings", label: "System Settings", icon: Settings },
    { href: "/admin/audit-logs", label: "Audit Logs", icon: Activity },
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
        <SidebarContent className="p-2">
          <SidebarMenu>
            {currentNavItems.map((item) => {
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
                      variant={isActive ? "active" : "border"}
                      tooltip={{ children: item.label, side: "right", align: "center" }}
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
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
               <Link href="/settings" passHref legacyBehavior>
                <SidebarMenuButton
                  asChild
                  variant={pathname === "/settings" ? "active" : "border"}
                  tooltip={{ children: "Settings", side: "right", align: "center" }}
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
          <div className="flex items-center gap-2">
            <HeaderClocks />
            <Button variant="outline" size="icon" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} className="h-9 w-9">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            {user && (
              <Button variant="outline" size="icon" aria-label="View notifications" asChild className="relative h-9 w-9">
                <Link href="/my-alerts">
                  <Bell className="h-4 w-4" />
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
                <Button variant="outline" className="relative h-9 w-9 rounded-full" aria-label="Open user menu">
                  <Avatar className="h-8 w-8">
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
