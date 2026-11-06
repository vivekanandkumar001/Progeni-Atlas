import { redirect } from 'next/navigation';
import { isValidSessionId } from '@/lib/api';

export default async function CandidateInterviewRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isValidSessionId(id)) {
    redirect('/candidate/interviews');
  }
  redirect(`/candidate/interview/${id}/lobby`);
}
