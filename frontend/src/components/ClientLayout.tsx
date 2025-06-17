'use client';

import { Suspense } from 'react';
import { RainbowKitProvider } from "@/src/providers/RainbowKitProvider";

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RainbowKitProvider>
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </RainbowKitProvider>
  );
} 