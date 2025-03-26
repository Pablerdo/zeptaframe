import { ThemeProvider } from "next-themes";
import { Navbar } from "./navbar";
import { Sidebar } from "./sidebar";
import { UserStatusProvider } from "@/features/auth/contexts/user-status-context";
import { auth } from "@/auth";

interface DashboardLayoutProps {
  children: React.ReactNode;
};

const DashboardLayout = async ({ children }: DashboardLayoutProps) => {
  // Get current user session
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const userId = session?.user?.id;
  
  return ( 
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem>
      <UserStatusProvider 
        initialUserStatus={{
          isAuthenticated,
          userId,
        }}
      >
        <div className="bg-muted h-full">
          <Sidebar />
          <div className="lg:pl-[300px] flex flex-col h-full">
            <Navbar />
            <main className="bg-white flex-1 overflow-auto p-8 lg:rounded-tl-2xl">
              {children}
            </main>
          </div>
        </div>
      </UserStatusProvider>
    </ThemeProvider>
  );
};
 
export default DashboardLayout;
