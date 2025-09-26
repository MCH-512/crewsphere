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
  SidebarGroup,
  SidebarGroupLabel
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
  ServerCog
} from "lucide-react";
import { useAuth, type User } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { HeaderClocks } from "@/components/features/header-clocks";
import { mainNavConfig, adminNavConfig } from "@/config/nav";
import { Separator } from "@/components/ui/separator";

const PUBLIC_PATHS = ['/login', '/signup'];

const useTheme = () => {
  const [theme, setTheme] = React.useState("light");

  React.useEffect(() => {
    const localTheme = localStorage.getItem("theme");
    if (localTheme) {
      setTheme(localTheme);
       if (localTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const systemTheme = prefersDark ? 'dark' : 'light';
        setTheme(systemTheme);
        localStorage.setItem('theme', systemTheme);
        if (prefersDark) {
            document.documentElement.classList.add('dark');
        }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };
  return { theme, toggleTheme };
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      router.push('/login');
    } catch (error) {
      console.error("Logout failed:", error);
      toast({ title: "Logout Failed", description: "Could not log you out. Please try again.", variant: "destructive" });
    }
  };

  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  React.useEffect(() => {
    if (loading) return;

    if (!user && !isPublicPath) {
      router.replace('/login');
    }
    if (user && isPublicPath) {
      router.replace('/');
    }
  }, [user, loading, isPublicPath, router]);


  if (loading || (!user && !isPublicPath) || (user && isPublicPath)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" aria-label="Loading application state" />
      </div>
    );
  }
  
  if (isPublicPath) {
    return <>{children}</>;
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
  user: User | null;
  handleLogout: () => void;
  theme: string;
  toggleTheme: () => void;
}) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();

  const isAdminPage = pathname.startsWith('/admin');
  const currentNavConfig = isAdminPage && user?.role === 'admin' ? adminNavConfig : mainNavConfig;
  
  const avatarFallback = user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : user?.email?.substring(0,2).toUpperCase() || 'U';

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar" side="left" className="border-r bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="h-16 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-2 text-sidebar-foreground hover:text-sidebar-primary transition-colors">
            <Plane className="w-8 h-8 text-primary" />
            <span className="font-bold text-lg group-data-[state=collapsed]:hidden">CrewSphere</span>
          </Link>
        </SidebarHeader>
        <SidebarContent className="p-2">
          {currentNavConfig.sidebarNav.map((navGroup, groupIndex) => (
            <SidebarGroup key={groupIndex}>
              <SidebarGroupLabel className="group-data-[state=collapsed]:hidden">{navGroup.title}</SidebarGroupLabel>
              <SidebarMenu>
                {navGroup.items.map((item) => {
                  if (item.roles && !item.roles.some((role: string) => user?.role === role)) return null;
                  const isActive = item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                     <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                            asChild
                            variant={isActive ? "active" : "ghost"}
                            tooltip={{ children: item.title, side: "right", align: "center" }}
                            className="h-9 w-full justify-start"
                        >
                            <Link href={item.href!}>
                               <item.icon className="w-4 h-4" />
                               <span className="group-data-[state=collapsed]:hidden">{item.title}</span>
                            </Link>
                         </SidebarMenuButton>
                     </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
          {isAdminPage && user?.role === 'admin' && (
             <SidebarGroup>
                <Separator className="my-2 bg-sidebar-border"/>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                              asChild
                              variant="ghost"
                              tooltip={{ children: "Exit Admin", side: "right", align: "center" }}
                              className="h-9 w-full justify-start"
                          >
                            <Link href="/">
                                <ServerCog className="w-4 h-4 text-destructive" />
                                <span className="group-data-[state=collapsed]:hidden">Exit Admin</span>
                            </Link>
                          </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarGroup>
          )}
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  variant={pathname === "/settings" ? "active" : "border"}
                  tooltip={{ children: "Settings", side: "right", align: "center" }}
                >
                  <Link href="/settings">
                    <Settings className="w-5 h-5" />
                    <span className="group-data-[state=collapsed]:hidden">Settings</span>
                  </Link>
                </SidebarMenuButton>
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
                    <AvatarImage src={user?.photoURL ?? undefined} alt="User Avatar" data-ai-hint="user portrait" />
                    <AvatarFallback>{avatarFallback}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user ? (
                  <>
                    <DropdownMenuLabel>
                      <p className="text-sm font-medium leading-none">{user.fullName || user.displayName || "User"}</p>
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
        <main id="main" className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </>
  );
}
