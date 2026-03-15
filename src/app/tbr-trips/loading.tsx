export default function TbrTripsLoading() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-28 bg-blue-200 dark:bg-blue-800 rounded animate-pulse" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
          >
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
            <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        ))}
        <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>

      {/* Trip list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-blue-200 dark:bg-blue-800 rounded-full animate-pulse" />
                </div>
                <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="flex-shrink-0 space-y-1 text-right">
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
