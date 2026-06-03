export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground tracking-wide">
            🍽 Recipe Book
          </h1>
          <p className="text-muted-foreground text-sm mt-1">family recipes, curated</p>
        </div>
        {children}
      </div>
    </div>
  );
}
