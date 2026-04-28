/**
 * LoadingButton Component
 * Single Responsibility: Button with loading state
 * Interface Segregation: Clean, focused API
 */
import React from 'react';
import { Button } from './ui/button';
import { Loader2 } from 'lucide-react';

export function LoadingButton({ loading, children, disabled, ...props }) {
  return (
    <Button disabled={loading || disabled} {...props}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading...
        </>
      ) : (
        children
      )}
    </Button>
  );
}
