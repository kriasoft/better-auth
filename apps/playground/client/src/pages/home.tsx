import { Link } from "react-router-dom";
import { useSession } from "../auth-client";

export function HomePage() {
  const session = useSession();

  return (
    <div className="space-y-8">
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Better Auth Playground
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Test environment for Better Auth plugins
        </p>

        {session.data ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Welcome back, {session.data.user.email}!
            </p>
            <Link
              to="/dashboard"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-x-4">
            <Link
              to="/signup"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="inline-block bg-gray-200 text-gray-800 px-6 py-3 rounded-md hover:bg-gray-300"
            >
              Login
            </Link>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Storage Plugin</h3>
          <p className="text-gray-600 mb-4">
            Connect Google Drive, OneDrive, and sync files
          </p>
          <Link to="/storage" className="text-blue-600 hover:text-blue-700">
            Test Storage →
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Analytics Plugin</h3>
          <p className="text-gray-600 mb-4">
            Track user events and view analytics
          </p>
          <span className="text-gray-400">Coming soon</span>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold mb-2">Audit Log Plugin</h3>
          <p className="text-gray-600 mb-4">
            Monitor all authentication activities
          </p>
          <span className="text-gray-400">Coming soon</span>
        </div>
      </div>
    </div>
  );
}
