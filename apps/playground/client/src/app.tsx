import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout";
import { ProtectedRoute } from "./components/protected-route";
import { HomePage } from "./pages/home";
import { LoginPage } from "./pages/login";
import { SignUpPage } from "./pages/signup";
import { DashboardPage } from "./pages/dashboard";
import { StoragePage } from "./pages/storage";

// App component that works for both SSR and CSR
// BrowserRouter is added in entry-client.tsx
// StaticRouter is added in entry-server.tsx
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignUpPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="storage/*" element={<StoragePage />} />
        </Route>
      </Route>
    </Routes>
  );
}
