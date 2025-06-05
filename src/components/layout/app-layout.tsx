
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
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
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
  FileText,
  CalendarDays,
  Brain,
  GraduationCap,
  Settings,
  LogOut,
  Plane,
  Bell,
  Moon,
  Sun,
  ServerCog,
  SendHorizonal,
  Navigation,
  Calculator,
  FileSignature,
  ListChecks,
  LogIn,
  UserPlus,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context"; // Ensure this path is correct
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "./breadcrumbs"; // Import Breadcrumbs

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/requests", label: "Requests", icon: SendHorizonal },
  { href: "/airport-briefings", label: "Airport Briefings", icon: Navigation },
  { href: "/flight-duty-calculator", label: "Duty Calculator", icon: Calculator },
  { href: "/purser-reports", label: "Purser Reports", icon: FileSignature },
  { href: "/insights", label: "AI Insights", icon: Brain },
  { href: "/training", label: "Training", icon: GraduationCap },
  { href: "/quizzes", label: "Quizzes", icon: ListChecks },
  { href: "/admin", label: "Admin Console", icon: ServerCog, adminOnly: true },
];

// Theme toggle functionality (simple example)
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
  const { isMobile } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();


  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // router.push("/login") is handled by AuthProvider
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
    }
  };

  const pageTitles: { [key: string]: string } = {
    "/": "Dashboard",
    "/documents": "Document Library",
    "/schedule": "My Schedule",
    "/requests": "Submit a Request",
    "/airport-briefings": "Airport Briefing Generator",
    "/flight-duty-calculator": "Flight Duty Calculator",
    "/purser-reports": "Purser Report Generator",
    "/insights": "AI-Driven Operational Insights",
    "/training": "My Training Hub",
    "/quizzes": "Quizzes",
    "/admin": "Admin Console",
    "/settings": "Settings",
    "/login": "Login",
    "/signup": "Sign Up",
    "/admin/users": "User Management",
    "/admin/documents/upload": "Upload New Document",
    "/admin/alerts": "All Broadcast Alerts",
    "/admin/alerts/create": "Create New Alert",
    "/admin/courses": "Courses Management",
    "/admin/courses/create": "Create New Training Course",
    "/admin/flights": "Manage Flights",
    "/admin/flights/create": "Add New Flight",
    "/admin/purser-reports": "Submitted Purser Reports",
    "/admin/user-requests": "User Submitted Requests",
  };
  
  // Find the most specific match for page titles
  let currentTitle = "AirCrew Hub"; // Default title
  let longestMatch = "";
  for (const path in pageTitles) {
      // Ensure that '/admin' does not incorrectly match '/admin/users' as more specific
      // We want an exact match or a match that ends with a '/'
      if (pathname === path || (pathname.startsWith(path) && path.endsWith('/') && path.length > longestMatch.length) || (pathname.startsWith(path + '/') && path.length > longestMatch.length)) {
        if (path.length > longestMatch.length) {
            longestMatch = path;
            currentTitle = pageTitles[path];
        }
      } else if (pathname.startsWith(path) && path.length > longestMatch.length && !pageTitles[pathname]) {
         // Fallback for dynamic paths if not explicitly defined, use parent
         longestMatch = path;
         currentTitle = pageTitles[path];
      }
  }
   // If an exact match for the full pathname exists, prioritize it
  if (pageTitles[pathname]) {
    currentTitle = pageTitles[pathname];
  }

  const currentPageTitle = currentTitle;


  // Hide sidebar and header for login/signup pages
  if (pathname === "/login" || pathname === "/signup") {
    return <>{children}</>;
  }
  
  if (loading && !user) { // Show loader only if genuinely loading auth state, not if user is already available
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
        <SidebarHeader className="h-16 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary transition-colors">
            <Plane className="w-8 h-8 text-primary" />
            <span className="font-bold text-xl group-data-[collapsible=icon]:hidden">AirCrew Hub</span>
          </Link>
        </SidebarHeader>
        <Separator />
        <SidebarContent className="p-2">
          <SidebarMenu>
            {navItems.map((item) => {
              if (item.adminOnly && user?.role !== 'admin') { 
                return null; 
              }
              return (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/")} // Highlight admin for subpages
                      tooltip={{ children: item.label, side: "right", align: "center" }}
                      className={cn(
                        "justify-start",
                        (pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/")) && "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 hover:text-sidebar-primary-foreground"
                      )}
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
          {isMobile && <SidebarTrigger />}
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-foreground">{currentPageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
            {user && (
              <Button variant="ghost" size="icon" aria-label="Notifications">
                <Bell className="h-5 w-5" />
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
          <Breadcrumbs /> {/* Add Breadcrumbs here */}
          {children}
        </main>
      </SidebarInset>
    </>
  );
}

    