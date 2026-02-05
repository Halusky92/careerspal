import Link from "next/link";

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-4xl font-black text-slate-900 mb-4">Page not found</h1>
        <p className="text-slate-500 font-medium mb-10">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl shadow-indigo-100"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
