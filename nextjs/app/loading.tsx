const Loading = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-4 text-slate-500 font-bold">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

export default Loading;
