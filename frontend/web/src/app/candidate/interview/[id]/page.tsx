import { redirect } from 'next/navigation';

export default async function CandidateInterviewRootPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/candidate/interview/${id}/lobby`);
}
