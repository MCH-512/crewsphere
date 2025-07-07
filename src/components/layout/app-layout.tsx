
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Settings,
  LogOut,
  Plane,
  Moon,
  Sun,
  ServerCog,
  LogIn,
  UserPlus,
  Loader2,
  Inbox,
  Lightbulb,
  Wrench,
  Users,
  ClipboardList,
  ClipboardCheck,
  MessageSquare,
  MessagesSquare,
  Activity,
  FileSignature,
  Calendar,
  Library,
  GraduationCap,
  CheckSquare,
  Compass,
  BellRing,
  BadgeAlert,
  NotebookPen,
  ShieldCheck,
  Book,
  Calculator,
  CloudSun,
  Globe,
  Map,
  Mic,
  ScrollText,
  ShieldAlert,
  Waypoints,
  ChevronDown,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "./breadcrumbs";
import { HeaderClocks } from "@/components/features/header-clocks";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-schedule", label: "My Schedule", icon: Calendar },
  { href: "/my-logbook", label: "My Logbook", icon: NotebookPen },
  { href: "/my-documents", label: "My Documents", icon: ShieldCheck },
  { href: "/flight-swap", label: "Flight Swap", icon: ArrowRightLeft },
  { href: "/training", label: "E-Learning", icon: GraduationCap },
  { href: "/document-library", label: "Document Library", icon: Library },
  { href: "/requests", label: "My Requests", icon: Inbox },
  { href: "/purser-reports", label: "Purser Reports", icon: FileSignature, roles: ['purser', 'admin'] },
  { href: "/suggestion-box", label: "Suggestion Box", icon: Lightbulb },
  {
    href: "/toolbox",
    label: "Toolbox",
    icon: Wrench,
    subItems: [
      { href: "/toolbox/weather-decoder", label: "Weather Decoder", icon: CloudSun },
      { href: "/toolbox/ftl-calculator", label: "FTL Calculator", icon: ShieldAlert },
      { href: "/toolbox/flight-timeline", label: "Flight Timeline", icon: Waypoints },
      { href: "/toolbox/live-flight-tracker", label: "Live Tracker", icon: Map },
      { href: "/toolbox/airport-directory", label: "Airport Directory", icon: Globe },
      { href: "/toolbox/converters", label: "Converters", icon: Calculator },
      { href: "/toolbox/aeronautical-jargon", label: "Jargon Glossary", icon: MessagesSquare },
      { href: "/toolbox/phonetic-alphabet", label: "Phonetic Alphabet", icon: Mic },
      { href: "/toolbox/aviation-history", label: "Aviation History", icon: ScrollText },
      { href: "/toolbox/guides", label: "Professional Guides", icon: Book },
    ]
  },
  { href: "/community-hub", label: "Community Hub", icon: Compass },
  { href: "/admin", label: "Admin Console", icon: ServerCog, roles: ['admin'] },
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
      >
        {children}
      </LayoutWithSidebar>
    </SidebarProvider>
  );
}

const CollapsibleSidebarItem = ({ item, pathname }: { item: typeof navItems[number], pathname: string }) => {
    const isSubActive = item.subItems?.some(sub => pathname.startsWith(sub.href)) ?? false;
    const [isOpen, setIsOpen] = React.useState(isSubActive);
  
    React.useEffect(() => {
      if (isSubActive) {
        setIsOpen(true);
      }
    }, [isSubActive]);
  
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          variant={isSubActive ? "active" : "border"}
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-between"
        >
          <div className="flex items-center gap-2">
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </div>
          <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
        </SidebarMenuButton>
        {isOpen && (
          <div className="ml-4 mt-1 border-l-2 border-sidebar-accent/50 pl-5 py-1">
            <SidebarMenu>
              {item.subItems?.map(subItem => (
                <SidebarMenuItem key={subItem.href}>
                  <Link href={subItem.href} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      variant={pathname.startsWith(subItem.href) ? "active" : "ghost"}
                      tooltip={{ children: subItem.label, side: "right", align: "center" }}
                      className="h-8 w-full justify-start"
                    >
                      <a>
                        <subItem.icon className="w-4 h-4" />
                        <span>{subItem.label}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </div>
        )}
      </SidebarMenuItem>
    );
}

function LayoutWithSidebar({
  children,
  user,
  handleLogout,
  theme,
  toggleTheme,
}: {
  children: React.ReactNode;
  user: any;
  handleLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();

  const adminNavItems = [
    { href: "/admin", label: "Admin Dashboard", icon: ServerCog },
    { href: "/admin/users", label: "User Management", icon: Users },
    { href: "/admin/flights", label: "Flight Management", icon: Plane },
    { href: "/admin/alerts", label: "Alert Management", icon: BellRing },
    { href: "/admin/expiry-management", label: "Document Expiry", icon: BadgeAlert },
    { href: "/admin/user-requests", label: "User Requests", icon: ClipboardList },
    { href: "/admin/purser-reports", label: "Purser Reports", icon: FileSignature },
    { href: "/admin/training-sessions", label: "Training Sessions", icon: ClipboardCheck },
    { href: "/admin/courses", label: "Course Management", icon: GraduationCap },
    { href: "/admin/quizzes", label: "Quiz Management", icon: CheckSquare },
    { href: "/admin/documents", label: "Documents", icon: Library },
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
            <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">Crew World</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {currentNavItems.map((item) => {
              if (item.roles && !item.roles.some((role: string) => user?.role === role)) {
                return null;
              }

              if (item.subItems) {
                return <CollapsibleSidebarItem key={item.label} item={item} pathname={pathname} />;
              }
              
              const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="relative h-9 w-9 rounded-full" aria-label="Open user menu">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || "https://placehold.co/100x100.png"} alt="User Avatar" data-ai-hint="user portrait" />
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
