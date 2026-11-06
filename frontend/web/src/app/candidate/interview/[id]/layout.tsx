import React from 'react';
import { MediaSourceProvider } from '@/lib/media/MediaSourceProvider';
import { isValidSessionId } from '@/lib/api';


export default async function CandidateInterviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: Promise<any>;
}) {
  const resolvedParams = params ? await params : {};
  const id = typeof resolvedParams?.id === 'string' ? resolvedParams.id : '';
  const validSessionId = isValidSessionId(id) ? id : '';

  return (
    <MediaSourceProvider sessionId={validSessionId}>
      {children}
    </MediaSourceProvider>
  );
}
