import { useEffect } from 'react';
import { useMarkContentReady } from '@/hooks/useContentReady';

export function UserProfile() {
  const onReady = useMarkContentReady();
  
  // Signal ready immediately for static page
  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6 text-foreground">User Profile</h1>
      <div className="bg-card border border-border rounded-lg shadow-sm p-8">
        <p className="text-muted-foreground">User profile page - Coming soon!</p>
      </div>
    </div>
  );
}
