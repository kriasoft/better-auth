import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../auth-client";

export function ProtectedRoute() {
  const session = useSession();

  if (session.isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!session.data) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
