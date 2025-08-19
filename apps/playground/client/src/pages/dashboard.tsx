import { useSession } from "../auth-client";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const session = useSession();

  if (!session.data) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Welcome back, {session.data.user.name || session.data.user.email}!
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">User Information</h2>
        <dl className="space-y-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">User ID</dt>
            <dd className="text-sm text-gray-900 font-mono">
              {session.data.user.id}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Email</dt>
            <dd className="text-sm text-gray-900">{session.data.user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Name</dt>
            <dd className="text-sm text-gray-900">
              {session.data.user.name || "Not set"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Email Verified
            </dt>
            <dd className="text-sm text-gray-900">
              {session.data.user.emailVerified ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Available Plugins</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            to="/storage"
            className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <h3 className="font-semibold text-blue-600">Storage Plugin</h3>
            <p className="text-sm text-gray-600 mt-1">
              Connect cloud storage providers and sync files
            </p>
          </Link>

          <div className="p-4 border rounded-lg opacity-50">
            <h3 className="font-semibold text-gray-400">
              More plugins coming soon
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Analytics, Audit Log, 2FA, and more
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
