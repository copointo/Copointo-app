import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import DashboardPage     from "@/pages/DashboardPage";
import CafesPage         from "@/pages/CafesPage";
import UsersPage         from "@/pages/UsersPage";
import CafeDashboardPage from "@/pages/CafeDashboardPage";
import Sidebar           from "@/components/Sidebar";

const queryClient = new QueryClient();

function AdminApp() {
  const [location] = useLocation();

  // Cafe dashboard has its own full-screen layout (no sidebar)
  if (location.startsWith("/cafe/")) {
    return (
      <Switch>
        <Route path="/cafe/:id" component={CafeDashboardPage} />
      </Switch>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar active={location} />
      <main className="flex-1 overflow-y-auto">
        <Switch>
          <Route path="/"       component={DashboardPage} />
          <Route path="/cafes"  component={CafesPage}     />
          <Route path="/users"  component={UsersPage}     />
        </Switch>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <AdminApp />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
