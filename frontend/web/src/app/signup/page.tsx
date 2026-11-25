import { redirect } from 'next/navigation';

/**
 * `/signup` was a dead 404 while public copy consistently sends visitors to
 * `/register`. Keep the old URL working as an alias instead of a broken entry
 * point.
 */
export default function SignupAliasPage() {
  redirect('/register');
}
