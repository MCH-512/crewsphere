
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
  SidebarGroup,
  SidebarGroupLabel,
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
  Settings,
  LogOut,
  LogIn,
  UserPlus,
  Loader2,
  Plane,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "./breadcrumbs";
import { HeaderClocks } from "@/components/features/header-clocks";
import { mainNavConfig, adminNavConfig } from "@/config/nav";

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

  const currentNavConfig = pathname.startsWith('/admin') && user?.role === 'admin' ? adminNavConfig : mainNavConfig;

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r">
        <SidebarHeader className="h-16 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary transition-colors">
            <Plane className="w-8 h-8 text-sidebar-primary" />
            <span className="font-bold text-lg group-data-[collapsible=icon]:hidden">AirCrew Hub</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          <SidebarMenu>
            {currentNavConfig.mainNav.map((item) => {
              if (item.roles && !item.roles.some((role: string) => user?.role === role)) {
                return null;
              }
              const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);

              return (
                <SidebarMenuItem key={item.href}>
                  <Link href={item.href!} passHref legacyBehavior>
                    <SidebarMenuButton
                      asChild
                      variant={isActive ? "active" : "border"}
                      tooltip={{ children: item.title, side: "right", align: "center" }}
                    >
                      <a>
                        <item.icon className="w-5 h-5" />
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              );
            })}
             {currentNavConfig.sidebarNav.map((navGroup, groupIndex) => (
              <React.Fragment key={groupIndex}>
                <SidebarGroup className="mt-4">
                  <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">{navGroup.title}</SidebarGroupLabel>
                  {navGroup.items.map((item) => {
                    if (item.roles && !item.roles.some((role: string) => user?.role === role)) return null;
                    const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
                    return (
                       <SidebarMenuItem key={item.href}>
                         <Link href={item.href!} passHref legacyBehavior>
                           <SidebarMenuButton
                              asChild
                              variant={isActive ? "active" : "ghost"}
                              tooltip={{ children: item.title, side: "right", align: "center" }}
                              className="h-9 w-full justify-start"
                           >
                              <a>
                                 <item.icon className="w-4 h-4" />
                                 <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                              </a>
                           </SidebarMenuButton>
                         </Link>
                       </SidebarMenuItem>
                    )
                  })}
                </SidebarGroup>
              </React.Fragment>
            ))}
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
