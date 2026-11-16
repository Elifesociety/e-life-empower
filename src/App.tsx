import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import About from "./pages/About";
import Divisions from "./pages/Divisions";
import DivisionDetail from "./pages/DivisionDetail";
import Programs from "./pages/Programs";
import ProgramPublic from "./pages/ProgramPublic";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Unauthorized from "./pages/Unauthorized";
const AdminsManagement = lazy(() => import("./pages/admin/AdminsManagement"));
const MembersManagement = lazy(() => import("./pages/admin/MembersManagement"));
const LocationsManagement = lazy(() => import("./pages/admin/LocationsManagement"));
const ClustersManagement = lazy(() => import("./pages/admin/ClustersManagement"));
const ProgramsManagement = lazy(() => import("./pages/admin/ProgramsManagement"));
const ProgramDetail = lazy(() => import("./pages/admin/ProgramDetail"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/admin/SuperAdminDashboard"));
const PennyekartAgentHierarchy = lazy(() => import("./pages/admin/PennyekartAgentHierarchy"));
const DivisionAdminDashboard = lazy(() => import("./pages/admin/DivisionAdminDashboard"));
const CashCollections = lazy(() => import("./pages/admin/CashCollections"));
const SuperAdminCashCollections = lazy(() => import("./pages/admin/SuperAdminCashCollections"));
const OldPaymentsUpload = lazy(() => import("./pages/admin/OldPaymentsUpload"));
const SalesReport = lazy(() => import("./pages/admin/SalesReport"));
const Payouts = lazy(() => import("./pages/admin/Payouts"));
const AgentTasks = lazy(() => import("./pages/admin/AgentTasks"));
const WhatsAppCommands = lazy(() => import("./pages/admin/WhatsAppCommands"));
const SamrambhakaManagement = lazy(() => import("./pages/admin/SamrambhakaManagement"));
const DepartmentsManagement = lazy(() => import("./pages/admin/DepartmentsManagement"));
import RegisterAgent from "./pages/RegisterAgent";
import Panchayaths from "./pages/Panchayaths";
import Samrabhaka from "./pages/Samrabhaka";
import Trainings from "./pages/Trainings";
import TrainingDetail from "./pages/TrainingDetail";
const TrainingsManagement = lazy(() => import("./pages/admin/TrainingsManagement"));
import { MobileGate } from "./components/MobileGate";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 3 * 60 * 1000, refetchOnWindowFocus: false } },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <MobileGate />
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/about" element={<About />} />
            <Route path="/divisions" element={<Divisions />} />
            <Route path="/division/:slug" element={<DivisionDetail />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/program/:id" element={<ProgramPublic />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/register-agent" element={<RegisterAgent />} />
            <Route path="/panchayaths" element={<Panchayaths />} />
            <Route path="/samrambhaka" element={<Samrabhaka />} />
            <Route path="/samrabhaka" element={<Samrabhaka />} />
            <Route path="/trainings" element={<Trainings />} />
            <Route path="/trainings/:id" element={<TrainingDetail />} />
            <Route
              path="/admin/trainings"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <TrainingsManagement />
                </ProtectedRoute>
              }
            />

            {/* Protected routes - Dashboard redirect */}

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin Dashboard */}
            <Route
              path="/admin-dashboard"
              element={
                <ProtectedRoute requiredRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Dashboard */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Super Admin only */}
            <Route
              path="/admin/admins"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <AdminsManagement />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Super Admin only: Locations */}
            <Route
              path="/admin/locations"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <LocationsManagement />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Admin & Super Admin: Clusters */}
            <Route
              path="/admin/clusters"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <ClustersManagement />
                </ProtectedRoute>
              }
            />
            
            {/* Admin routes - Admin & Super Admin: Members */}
            <Route
              path="/admin/members"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <MembersManagement />
                </ProtectedRoute>
              }
            />

            {/* Admin routes - Admin & Super Admin: Programs */}
            <Route
              path="/admin/programs"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <ProgramsManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/programs/:id"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <ProgramDetail />
                </ProtectedRoute>
              }
            />

            {/* Pennyekart Agent Hierarchy - Admin & Super Admin */}
            <Route
              path="/admin/pennyekart-agents"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <PennyekartAgentHierarchy />
                </ProtectedRoute>
              }
            />

            {/* Agent Tasks - Admin & Super Admin */}
            <Route
              path="/admin/agent-tasks"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <AgentTasks />
                </ProtectedRoute>
              }
            />

            {/* Division Admin Dashboard - Admin & Super Admin */}
            <Route
              path="/admin/division/:divisionId"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <DivisionAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Cash Collections - Admin & Super Admin */}
            <Route
              path="/admin/division/:divisionId/cash-collections"
              element={
                <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                  <CashCollections />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Cash Collections - All Divisions */}
            <Route
              path="/super-admin/cash-collections"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <SuperAdminCashCollections />
                </ProtectedRoute>
              }
            />

            {/* Old Payments Upload - Super Admin only */}
            <Route
              path="/super-admin/old-payments"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <OldPaymentsUpload />
                </ProtectedRoute>
              }
            />

            {/* Pennyekart Sales Report - Super Admin only */}
            <Route
              path="/admin/sales-report"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <SalesReport />
                </ProtectedRoute>
              }
            />

            {/* Pennyekart Payouts - Super Admin only */}
            <Route
              path="/admin/payouts"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <Payouts />
                </ProtectedRoute>
              }
            />

            {/* WhatsApp Bot Commands - Super Admin only */}
            <Route
              path="/admin/whatsapp-commands"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <WhatsAppCommands />
                </ProtectedRoute>
              }
            />

            {/* Departments - Super Admin only */}
            <Route
              path="/super-admin/departments"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <DepartmentsManagement />
                </ProtectedRoute>
              }
            />

            {/* Samrambhaka Management - Super Admin only */}
            <Route
              path="/super-admin/samrambhaka"
              element={
                <ProtectedRoute requiredRoles={["super_admin"]}>
                  <SamrambhakaManagement />
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
