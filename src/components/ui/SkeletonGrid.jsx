export default function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border border-aspectum-border rounded-aspectum-control overflow-hidden animate-pulse">
          <div className="aspect-square bg-aspectum-border" />
          <div className="p-2 space-y-1">
            <div className="h-3 bg-aspectum-border rounded w-3/4" />
            <div className="h-2 bg-aspectum-border rounded w-1/2" />
            <div className="h-2 bg-aspectum-border rounded w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
