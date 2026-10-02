'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Upload,
  FileText,
  X,
  CheckCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Phone,
  GraduationCap,
  BookOpen,
  Calendar,
  Building2,
  Briefcase,
  Users,
  Check,
} from 'lucide-react';
import {
  RegisterValidationSchema,
  RegisterFormData,
  RecruiterRegisterSchema,
  RecruiterFormData,
  getCourseYears,
} from '@/lib/validations/register';

// Reusable Form Label Component with Mandatory Red Asterisk (*) & Inline Icon
interface FormLabelProps {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
}

export const FormLabel = ({ label, required = true, icon }: FormLabelProps) => (
  <label className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 mb-1.5">
    {icon && <span className="text-[#38bdf8] shrink-0">{icon}</span>}
    <span>{label}</span>
    {required && <span className="text-rose-500 font-bold">*</span>}
  </label>
);

export default function RegisterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'recruiter' | null>(null);

  // Candidate Form States
  const [showPasswordCandidate, setShowPasswordCandidate] = useState(false);
  const [showConfirmPasswordCandidate, setShowConfirmPasswordCandidate] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmittingCandidate, setIsSubmittingCandidate] = useState(false);

  // Recruiter Form States
  const [showPasswordRecruiter, setShowPasswordRecruiter] = useState(false);
  const [showConfirmPasswordRecruiter, setShowConfirmPasswordRecruiter] = useState(false);
  const [isSubmittingRecruiter, setIsSubmittingRecruiter] = useState(false);

  // Candidate Form Setup
  const candidateForm = useForm<RegisterFormData>({
    resolver: zodResolver(RegisterValidationSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      course: 'B.Tech',
      branch: 'Computer Science & Engineering',
      year: '1st Year',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false as any,
    },
  });

  const candidateValues = candidateForm.watch();
  const watchedCandidateName = candidateValues.fullName || '';
  const watchedCandidateCourse = candidateValues.course || 'B.Tech';
  const watchedCandidateBranch = candidateValues.branch;
  const watchedCandidateYear = candidateValues.year || '1st Year';
  const watchedCandidateEmail = candidateValues.email || '';
  const watchedCandidatePhone = candidateValues.phone || '';
  const watchedCandidatePassword = candidateValues.password || '';
  const watchedCandidateConfirmPassword = candidateValues.confirmPassword || '';

  const isCandidateFormFilled = Boolean(
    candidateValues.fullName?.trim() &&
      candidateValues.email?.trim() &&
      candidateValues.course &&
      candidateValues.branch &&
      candidateValues.year &&
      candidateValues.phone?.trim() &&
      candidateValues.password &&
      candidateValues.confirmPassword &&
      candidateValues.resume &&
      candidateValues.agreeTerms === true
  );

  const availableYears = getCourseYears(watchedCandidateCourse);
  const courseOptions = ['B.Tech', 'M.Tech', 'BCA', 'MCA', 'B.Sc CS', 'Other'];
  const branchOptions = [
    'Computer Science & Engineering',
    'Artificial Intelligence & ML',
    'Data Science',
    'Information Technology',
    'ECE',
    'Other',
  ];

  // Recruiter Form Setup
  const recruiterForm = useForm<RecruiterFormData>({
    resolver: zodResolver(RecruiterRegisterSchema),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
    defaultValues: {
      fullName: '',
      workEmail: '',
      companyName: '',
      designation: '',
      teamSize: '11-50 Employees',
      phone: '',
      password: '',
      confirmPassword: '',
      agreeTerms: false as any,
    },
  });

  const recruiterValues = recruiterForm.watch();
  const watchedRecruiterName = recruiterValues.fullName || '';
  const watchedWorkEmail = recruiterValues.workEmail || '';
  const watchedCompanyName = recruiterValues.companyName || '';
  const watchedDesignation = recruiterValues.designation || '';
  const watchedTeamSize = recruiterValues.teamSize || '11-50 Employees';
  const watchedRecruiterPhone = recruiterValues.phone || '';
  const watchedRecruiterPassword = recruiterValues.password || '';
  const watchedRecruiterConfirmPassword = recruiterValues.confirmPassword || '';

  const isRecruiterFormFilled = Boolean(
    recruiterValues.fullName?.trim() &&
      recruiterValues.workEmail?.trim() &&
      recruiterValues.companyName?.trim() &&
      recruiterValues.designation?.trim() &&
      recruiterValues.teamSize &&
      recruiterValues.phone?.trim() &&
      recruiterValues.password &&
      recruiterValues.confirmPassword &&
      recruiterValues.agreeTerms === true
  );

  const teamSizeOptions = [
    '1-10 Employees',
    '11-50 Employees',
    '51-200 Employees',
    '201-1000 Employees',
    '1000+ Employees',
  ];

  // Sanitizers
  const handleNameChangeCandidate = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/^\s+/, '').replace(/\s+/g, ' ');
    candidateForm.setValue('fullName', raw.replace(/\b\w/g, (char) => char.toUpperCase()));
  };

  const handleEmailChangeCandidate = (e: React.ChangeEvent<HTMLInputElement>) => {
    candidateForm.setValue('email', e.target.value.replace(/\s/g, '').toLowerCase());
  };

  const handlePhoneChangeCandidate = (e: React.ChangeEvent<HTMLInputElement>) => {
    candidateForm.setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10));
  };

  const handleNameChangeRecruiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/^\s+/, '').replace(/\s+/g, ' ');
    recruiterForm.setValue('fullName', raw.replace(/\b\w/g, (char) => char.toUpperCase()));
  };

  const handleEmailChangeRecruiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    recruiterForm.setValue('workEmail', e.target.value.replace(/\s/g, '').toLowerCase());
  };

  const handlePhoneChangeRecruiter = (e: React.ChangeEvent<HTMLInputElement>) => {
    recruiterForm.setValue('phone', e.target.value.replace(/\D/g, '').slice(0, 10));
  };

  // Password Strength Logic
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass) && /[0-9]/.test(pass)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) score += 1;

    if (score === 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
    if (score === 2) return { score: 2, label: 'Medium', color: 'bg-yellow-500' };
    return { score: 3, label: 'Strong', color: 'bg-[#10b981]' };
  };

  const candidateStrength = getPasswordStrength(watchedCandidatePassword);
  const candidatePasswordsMatch =
    watchedCandidateConfirmPassword.length > 0 && watchedCandidatePassword === watchedCandidateConfirmPassword;
  const candidatePasswordsMismatch =
    watchedCandidateConfirmPassword.length > 0 && watchedCandidatePassword !== watchedCandidateConfirmPassword;

  const recruiterStrength = getPasswordStrength(watchedRecruiterPassword);
  const recruiterPasswordsMatch =
    watchedRecruiterConfirmPassword.length > 0 && watchedRecruiterPassword === watchedRecruiterConfirmPassword;
  const recruiterPasswordsMismatch =
    watchedRecruiterConfirmPassword.length > 0 && watchedRecruiterPassword !== watchedRecruiterConfirmPassword;

  // File upload handlers
  const handleFileDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      candidateForm.setValue('resume', file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      candidateForm.setValue('resume', file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    candidateForm.setValue('resume', undefined as any);
  };

  const [globalErrorMsg, setGlobalErrorMsg] = useState<string>('');

  const onSubmitCandidate = async (data: RegisterFormData) => {
    setIsSubmittingCandidate(true);
    setGlobalErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          password: data.password,
          role: 'candidate',
          phone: data.phone,
        }),
      });

      const result = await res.json();

      if (res.status === 409 || result.isDuplicate) {
        setGlobalErrorMsg('An account with this email address already exists. Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || 'Registration failed.');
      }

      router.push(result.redirectUrl || `/verify-otp?email=${encodeURIComponent(data.email)}&purpose=REGISTRATION_VERIFY`);
    } catch (err: any) {
      setGlobalErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmittingCandidate(false);
    }
  };

  const onSubmitRecruiter = async (data: RecruiterFormData) => {
    setIsSubmittingRecruiter(true);
    setGlobalErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.workEmail,
          password: data.password,
          role: 'recruiter',
          phone: data.phone,
        }),
      });

      const result = await res.json();

      if (res.status === 409 || result.isDuplicate) {
        setGlobalErrorMsg('An account with this email address already exists. Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
        return;
      }

      if (!res.ok) {
        throw new Error(result.error || 'Registration failed.');
      }

      router.push(result.redirectUrl || `/verify-otp?email=${encodeURIComponent(data.workEmail)}&purpose=REGISTRATION_VERIFY`);
    } catch (err: any) {
      setGlobalErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmittingRecruiter(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] font-sans flex flex-col justify-between relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-0 w-full h-full ambient-glow-cyan pointer-events-none z-0" />
      <div className="absolute bottom-0 right-0 w-full h-full ambient-glow-indigo pointer-events-none z-0" />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Minimal Header */}
        <header className="w-full border-b border-slate-800/80 px-6 py-4 backdrop-blur-md bg-slate-950/80">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 group">
              <div className="cyan-pulse-dot" />
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                TalentPulse<span className="text-[#38bdf8]">.AI</span>
              </span>
            </Link>

            <div className="text-xs font-medium text-[#94a3b8]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#38bdf8] font-semibold hover:underline inline-flex items-center space-x-1 ml-1">
                <span>Sign In</span>
                <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </div>
        </header>

        {/* Main Content (Responsive Re-ordered Layout) */}
        <main className="flex-grow max-w-7xl w-full mx-auto px-6 py-8 flex items-center">
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 w-full items-start">
            
            {/* SECTION A: FORM CONTAINER (ORDER 1 ON MOBILE, RIGHT COL ON DESKTOP) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full order-1 lg:order-2 lg:col-span-7"
            >
              <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md space-y-6">
                
                {globalErrorMsg && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{globalErrorMsg}</span>
                  </div>
                )}
                <AnimatePresence mode="wait">
                  {/* STEP 1: ROLE SELECTION SCREEN */}
                  {selectedRole === null ? (
                    <motion.div
                      key="step-1-role-selection"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-6"
                    >
                      <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Choose Your Account Type</h2>
                        <p className="text-sm text-slate-400 mt-1">Select how you intend to use TalentPulse AI.</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Option 1: Candidate Card */}
                        <div 
                          onClick={() => setSelectedRole('candidate')}
                          className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-400/80 hover:bg-slate-900 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform">
                              <GraduationCap className="w-6 h-6"/>
                            </div>
                            <h3 className="text-lg font-bold text-white">Candidate / Student</h3>
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                              Take real-time AI video interviews, practice technical rounds, and receive detailed skill scorecards.
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 mt-5 group-hover:translate-x-1 transition-transform">
                            Continue as Candidate →
                          </span>
                        </div>

                        {/* Option 2: Recruiter Card */}
                        <div 
                          onClick={() => setSelectedRole('recruiter')}
                          className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-indigo-400/80 hover:bg-slate-900 cursor-pointer transition-all duration-200 group flex flex-col justify-between"
                        >
                          <div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-105 transition-transform">
                              <Building2 className="w-6 h-6"/>
                            </div>
                            <h3 className="text-lg font-bold text-white">Recruiter / Enterprise</h3>
                            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                              Automate technical candidate screenings, customize interview rubrics, and access verified audit dossiers.
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 mt-5 group-hover:translate-x-1 transition-transform">
                            Continue as Recruiter →
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ) : selectedRole === 'candidate' ? (
                    
                    /* STEP 2A: CANDIDATE FORM */
                    <motion.div
                      key="step-2-candidate-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <button
                          type="button"
                          onClick={() => setSelectedRole(null)}
                          className="inline-flex items-center space-x-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Change Account Type</span>
                        </button>

                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] font-mono font-semibold text-cyan-400 flex items-center space-x-1">
                          <GraduationCap className="w-3 h-3 mr-1" />
                          Candidate Form
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-white mb-2">Candidate & Student Registration</h2>

                      <form onSubmit={candidateForm.handleSubmit(onSubmitCandidate)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Row 1, Col 1: Full Name */}
                          <div>
                            <FormLabel label="Full Name" required />
                            <input
                              value={watchedCandidateName}
                              onChange={handleNameChangeCandidate}
                              type="text"
                              placeholder="John Doe"
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                candidateForm.formState.isSubmitted && candidateForm.formState.errors.fullName
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-[#38bdf8]'
                              }`}
                            />
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.fullName && (
                              <p className="text-xs text-rose-400 mt-1 block leading-tight animate-fadeIn">
                                {candidateForm.formState.errors.fullName.message}
                              </p>
                            )}
                          </div>

                          {/* Row 1, Col 2: Email Address */}
                          <div>
                            <FormLabel label="Email Address" required />
                            <input
                              value={watchedCandidateEmail}
                              onChange={handleEmailChangeCandidate}
                              type="email"
                              placeholder="john.doe@example.com"
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                candidateForm.formState.isSubmitted && candidateForm.formState.errors.email
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-[#38bdf8]'
                              }`}
                            />
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.email && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.email.message}
                              </p>
                            )}
                          </div>

                          {/* Row 2, Col 1: Course */}
                          <div>
                            <FormLabel label="Course" required icon={<GraduationCap className="w-4 h-4 text-cyan-400" />} />
                            <select
                              value={watchedCandidateCourse}
                              onChange={(e) => {
                                const newCourse = e.target.value;
                                candidateForm.setValue('course', newCourse);
                                const newYears = getCourseYears(newCourse);
                                if (!newYears.includes(watchedCandidateYear)) {
                                  candidateForm.setValue('year', newYears[0]);
                                }
                              }}
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white focus:outline-none transition-colors ${
                                candidateForm.formState.isSubmitted && candidateForm.formState.errors.course
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-[#38bdf8]'
                              }`}
                            >
                              {courseOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.course && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.course.message}
                              </p>
                            )}
                          </div>

                          {/* Row 2, Col 2: Branch */}
                          <div>
                            <FormLabel label="Branch / Specialization" required icon={<BookOpen className="w-4 h-4 text-[#10b981]" />} />
                            <select
                              value={watchedCandidateBranch}
                              onChange={(e) => candidateForm.setValue('branch', e.target.value)}
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white focus:outline-none transition-colors ${
                                candidateForm.formState.isSubmitted && candidateForm.formState.errors.branch
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-[#10b981]'
                              }`}
                            >
                              {branchOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.branch && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.branch.message}
                              </p>
                            )}
                          </div>

                          {/* Row 3, Col 1: Academic Year */}
                          <div>
                            <FormLabel label="Academic Year" required icon={<Calendar className="w-4 h-4 text-cyan-400" />} />
                            <select
                              value={watchedCandidateYear}
                              onChange={(e) => candidateForm.setValue('year', e.target.value)}
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white focus:outline-none transition-colors ${
                                candidateForm.formState.isSubmitted && candidateForm.formState.errors.year
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-[#38bdf8]'
                              }`}
                            >
                              {availableYears.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.year && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.year.message}
                              </p>
                            )}
                          </div>

                          {/* Row 3, Col 2: Phone */}
                          <div>
                            <FormLabel label="Phone Number" required />
                            <div className="relative flex items-center">
                              <span className="px-3 py-2.5 bg-slate-900 border border-r-0 border-slate-800 rounded-l-lg text-xs font-mono font-semibold text-[#38bdf8] flex items-center space-x-1">
                                <Phone className="w-3 h-3 mr-1 text-[#38bdf8]" />
                                +91
                              </span>
                              <input
                                value={watchedCandidatePhone}
                                onChange={handlePhoneChangeCandidate}
                                type="tel"
                                maxLength={10}
                                placeholder="9876543210"
                                className={`w-full px-3.5 py-2.5 rounded-r-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                  candidateForm.formState.isSubmitted && candidateForm.formState.errors.phone
                                    ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                    : 'border-slate-800 focus:border-[#38bdf8]'
                                }`}
                              />
                            </div>
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.phone && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.phone.message}
                              </p>
                            )}
                          </div>

                          {/* Row 4, Col 1: Password */}
                          <div>
                            <FormLabel label="Password" required />
                            <div className="relative">
                              <input
                                {...candidateForm.register('password')}
                                type={showPasswordCandidate ? 'text' : 'password'}
                                placeholder="••••••••"
                                className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-10 ${
                                  candidateForm.formState.isSubmitted && candidateForm.formState.errors.password
                                    ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                    : 'border-slate-800 focus:border-[#38bdf8]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswordCandidate(!showPasswordCandidate)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              >
                                {showPasswordCandidate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.password && (
                              <p className="text-xs text-rose-400 mt-1 block leading-tight animate-fadeIn">
                                {candidateForm.formState.errors.password.message}
                              </p>
                            )}

                            {watchedCandidatePassword && (
                              <div className="mt-2 space-y-1">
                                <div className="flex space-x-1.5 h-1">
                                  <div className={`h-full flex-1 rounded ${candidateStrength.score >= 1 ? candidateStrength.color : 'bg-slate-800'}`} />
                                  <div className={`h-full flex-1 rounded ${candidateStrength.score >= 2 ? candidateStrength.color : 'bg-slate-800'}`} />
                                  <div className={`h-full flex-1 rounded ${candidateStrength.score >= 3 ? candidateStrength.color : 'bg-slate-800'}`} />
                                </div>
                                <span className="text-[11px] font-mono text-slate-400 block">
                                  Strength: <span className="font-semibold text-slate-200">{candidateStrength.label}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Row 4, Col 2: Confirm Password */}
                          <div>
                            <FormLabel label="Confirm Password" required />
                            <div className="relative">
                              <input
                                {...candidateForm.register('confirmPassword')}
                                type={showConfirmPasswordCandidate ? 'text' : 'password'}
                                placeholder="••••••••"
                                className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-10 ${
                                  candidateForm.formState.isSubmitted && candidateForm.formState.errors.confirmPassword
                                    ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                    : 'border-slate-800 focus:border-[#38bdf8]'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPasswordCandidate(!showConfirmPasswordCandidate)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              >
                                {showConfirmPasswordCandidate ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            {candidatePasswordsMatch && (
                              <div className="mt-1 flex items-center space-x-1 text-xs text-[#10b981] font-mono">
                                <Check className="w-3.5 h-3.5 text-[#10b981]" />
                                <span>Passwords match</span>
                              </div>
                            )}
                            {candidatePasswordsMismatch && (
                              <div className="mt-1 flex items-center space-x-1 text-xs text-rose-400 font-mono">
                                <X className="w-3.5 h-3.5 text-rose-400" />
                                <span>Passwords do not match</span>
                              </div>
                            )}
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.confirmPassword && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.confirmPassword.message}
                              </p>
                            )}
                          </div>

                          {/* Row 5: Upload Resume */}
                          <div className="md:col-span-2">
                            <FormLabel label="Upload Resume (PDF / DOCX - Max 5MB)" required />
                            {selectedFile ? (
                              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-[#38bdf8]/50 text-xs shadow-[0_0_10px_rgba(56,189,248,0.2)]">
                                <div className="flex items-center space-x-2 truncate">
                                  <FileText className="w-4 h-4 text-[#38bdf8] shrink-0" />
                                  <span className="text-white truncate font-medium">{selectedFile.name}</span>
                                  <span className="text-slate-400 text-[10px]">
                                    ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={removeFile}
                                  className="text-slate-400 hover:text-rose-400 p-1 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <label
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  setIsDragOver(true);
                                }}
                                onDragLeave={() => setIsDragOver(false)}
                                onDrop={handleFileDrop}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg bg-slate-950 border-2 border-dashed transition-all cursor-pointer text-center ${
                                  candidateForm.formState.isSubmitted && candidateForm.formState.errors.resume
                                    ? 'border-rose-500/80 bg-rose-950/10'
                                    : isDragOver
                                    ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_18px_rgba(34,211,238,0.4)]'
                                    : 'border-slate-800 hover:border-[#38bdf8]/60'
                                }`}
                              >
                                <Upload className="w-5 h-5 text-[#38bdf8] mb-1" />
                                <span className="text-xs text-slate-300 font-medium">
                                  Drag & drop or click to upload your resume
                                </span>
                                <span className="text-[10px] text-slate-500 mt-1">
                                  Your resume helps our AI ask relevant questions based on your actual projects and coursework.
                                </span>
                                <input
                                  type="file"
                                  accept=".pdf,.docx,.doc"
                                  onChange={handleFileChange}
                                  className="hidden"
                                />
                              </label>
                            )}
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.resume && (
                              <p className="text-xs text-rose-400 mt-1 block font-semibold animate-fadeIn">
                                {candidateForm.formState.errors.resume.message as string}
                              </p>
                            )}
                          </div>

                          {/* Row 6 & Row 7: Terms & Submit */}
                          <div className="md:col-span-2 space-y-4 pt-2">
                            <label className="flex items-start space-x-2 cursor-pointer">
                              <input
                                {...candidateForm.register('agreeTerms')}
                                type="checkbox"
                                className="mt-1 rounded bg-slate-950 border-slate-800 text-[#38bdf8] focus:ring-0"
                              />
                              <span className="text-xs text-[#94a3b8] leading-normal font-normal">
                                I agree to the Candidate Terms of Service and Privacy Policy. <span className="text-rose-500 font-bold ml-0.5">*</span>
                              </span>
                            </label>
                            {candidateForm.formState.isSubmitted && candidateForm.formState.errors.agreeTerms && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {candidateForm.formState.errors.agreeTerms.message}
                              </p>
                            )}

                            <button
                              type="submit"
                              disabled={!isCandidateFormFilled || isSubmittingCandidate}
                              className={`w-full py-3.5 px-6 rounded-full font-bold text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                                isCandidateFormFilled
                                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white cursor-pointer shadow-lg shadow-cyan-500/20 hover:scale-[1.01]'
                                  : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50 pointer-events-none'
                              }`}
                            >
                              {isSubmittingCandidate ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                                  <span>Creating profile...</span>
                                </>
                              ) : (
                                <span>Complete Registration & Launch Interview →</span>
                              )}
                            </button>
                          </div>

                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    
                    /* STEP 2B: RECRUITER FORM */
                    <motion.div
                      key="step-2-recruiter-form"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <button
                          type="button"
                          onClick={() => setSelectedRole(null)}
                          className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Change Account Type</span>
                        </button>

                        <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-mono font-semibold text-indigo-400 flex items-center space-x-1">
                          <Building2 className="w-3 h-3 mr-1" />
                          Recruiter Form
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-white mb-2">Recruiter & Enterprise Registration</h2>

                      <form onSubmit={recruiterForm.handleSubmit(onSubmitRecruiter)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          {/* Row 1, Col 1: Full Name */}
                          <div>
                            <FormLabel label="Full Name" required />
                            <input
                              value={watchedRecruiterName}
                              onChange={handleNameChangeRecruiter}
                              type="text"
                              placeholder="Sarah Jenkins"
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.fullName
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-indigo-400'
                              }`}
                            />
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.fullName && (
                              <p className="text-xs text-rose-400 mt-1 block leading-tight animate-fadeIn">
                                {recruiterForm.formState.errors.fullName.message}
                              </p>
                            )}
                          </div>

                          {/* Row 1, Col 2: Work Email */}
                          <div>
                            <FormLabel label="Work Email Address" required />
                            <input
                              value={watchedWorkEmail}
                              onChange={handleEmailChangeRecruiter}
                              type="email"
                              placeholder="sarah@techcorp.io"
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.workEmail
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-indigo-400'
                              }`}
                            />
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.workEmail && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.workEmail.message}
                              </p>
                            )}
                          </div>

                          {/* Row 2, Col 1: Company Name */}
                          <div>
                            <FormLabel label="Company / Organization Name" required icon={<Building2 className="w-4 h-4 text-indigo-400" />} />
                            <input
                              {...recruiterForm.register('companyName')}
                              type="text"
                              placeholder="TechCorp Solutions"
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.companyName
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-indigo-400'
                              }`}
                            />
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.companyName && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.companyName.message}
                              </p>
                            )}
                          </div>

                          {/* Row 2, Col 2: Designation */}
                          <div>
                            <FormLabel label="Job Designation" required icon={<Briefcase className="w-4 h-4 text-indigo-400" />} />
                            <input
                              {...recruiterForm.register('designation')}
                              type="text"
                              placeholder="Lead Technical Recruiter"
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.designation
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-indigo-400'
                              }`}
                            />
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.designation && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.designation.message}
                              </p>
                            )}
                          </div>

                          {/* Row 3, Col 1: Team Size */}
                          <div>
                            <FormLabel label="Company Team Size" required icon={<Users className="w-4 h-4 text-indigo-400" />} />
                            <select
                              value={watchedTeamSize}
                              onChange={(e) => recruiterForm.setValue('teamSize', e.target.value)}
                              className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white focus:outline-none transition-colors ${
                                recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.teamSize
                                  ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                  : 'border-slate-800 focus:border-indigo-400'
                              }`}
                            >
                              {teamSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.teamSize && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.teamSize.message}
                              </p>
                            )}
                          </div>

                          {/* Row 3, Col 2: Phone */}
                          <div>
                            <FormLabel label="Phone Number" required />
                            <div className="relative flex items-center">
                              <span className="px-3 py-2.5 bg-slate-900 border border-r-0 border-slate-800 rounded-l-lg text-xs font-mono font-semibold text-indigo-400 flex items-center space-x-1">
                                <Phone className="w-3 h-3 mr-1 text-indigo-400" />
                                +91
                              </span>
                              <input
                                value={watchedRecruiterPhone}
                                onChange={handlePhoneChangeRecruiter}
                                type="tel"
                                maxLength={10}
                                placeholder="9876543210"
                                className={`w-full px-3.5 py-2.5 rounded-r-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors ${
                                  recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.phone
                                    ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                    : 'border-slate-800 focus:border-indigo-400'
                                }`}
                              />
                            </div>
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.phone && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.phone.message}
                              </p>
                            )}
                          </div>

                          {/* Row 4, Col 1: Password */}
                          <div>
                            <FormLabel label="Password" required />
                            <div className="relative">
                              <input
                                {...recruiterForm.register('password')}
                                type={showPasswordRecruiter ? 'text' : 'password'}
                                placeholder="••••••••"
                                className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-10 ${
                                  recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.password
                                    ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                    : 'border-slate-800 focus:border-indigo-400'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPasswordRecruiter(!showPasswordRecruiter)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              >
                                {showPasswordRecruiter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.password && (
                              <p className="text-xs text-rose-400 mt-1 block leading-tight animate-fadeIn">
                                {recruiterForm.formState.errors.password.message}
                              </p>
                            )}

                            {watchedRecruiterPassword && (
                              <div className="mt-2 space-y-1">
                                <div className="flex space-x-1.5 h-1">
                                  <div className={`h-full flex-1 rounded ${recruiterStrength.score >= 1 ? recruiterStrength.color : 'bg-slate-800'}`} />
                                  <div className={`h-full flex-1 rounded ${recruiterStrength.score >= 2 ? recruiterStrength.color : 'bg-slate-800'}`} />
                                  <div className={`h-full flex-1 rounded ${recruiterStrength.score >= 3 ? recruiterStrength.color : 'bg-slate-800'}`} />
                                </div>
                                <span className="text-[11px] font-mono text-slate-400 block">
                                  Strength: <span className="font-semibold text-slate-200">{recruiterStrength.label}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Row 4, Col 2: Confirm Password */}
                          <div>
                            <FormLabel label="Confirm Password" required />
                            <div className="relative">
                              <input
                                {...recruiterForm.register('confirmPassword')}
                                type={showConfirmPasswordRecruiter ? 'text' : 'password'}
                                placeholder="••••••••"
                                className={`w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border text-sm text-white placeholder-slate-500 focus:outline-none transition-colors pr-10 ${
                                  recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.confirmPassword
                                    ? 'border-rose-500/80 focus:border-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                                    : 'border-slate-800 focus:border-indigo-400'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPasswordRecruiter(!showConfirmPasswordRecruiter)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                              >
                                {showConfirmPasswordRecruiter ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            {recruiterPasswordsMatch && (
                              <div className="mt-1 flex items-center space-x-1 text-xs text-[#10b981] font-mono">
                                <Check className="w-3.5 h-3.5 text-[#10b981]" />
                                <span>Passwords match</span>
                              </div>
                            )}
                            {recruiterPasswordsMismatch && (
                              <div className="mt-1 flex items-center space-x-1 text-xs text-rose-400 font-mono">
                                <X className="w-3.5 h-3.5 text-rose-400" />
                                <span>Passwords do not match</span>
                              </div>
                            )}
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.confirmPassword && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.confirmPassword.message}
                              </p>
                            )}
                          </div>

                          {/* Row 5: Terms & Submit */}
                          <div className="md:col-span-2 space-y-4 pt-2">
                            <label className="flex items-start space-x-2 cursor-pointer">
                              <input
                                {...recruiterForm.register('agreeTerms')}
                                type="checkbox"
                                className="mt-1 rounded bg-slate-950 border-slate-800 text-indigo-500 focus:ring-0"
                              />
                              <span className="text-xs text-[#94a3b8] leading-normal font-normal">
                                I agree to the Enterprise Services Agreement and Evaluation Terms. <span className="text-rose-500 font-bold ml-0.5">*</span>
                              </span>
                            </label>
                            {recruiterForm.formState.isSubmitted && recruiterForm.formState.errors.agreeTerms && (
                              <p className="text-xs text-rose-400 mt-1 block animate-fadeIn">
                                {recruiterForm.formState.errors.agreeTerms.message}
                              </p>
                            )}

                            <button
                              type="submit"
                              disabled={!isRecruiterFormFilled || isSubmittingRecruiter}
                              className={`w-full py-3.5 px-6 rounded-full font-bold text-sm transition-all duration-200 flex items-center justify-center space-x-2 ${
                                isRecruiterFormFilled
                                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white cursor-pointer shadow-lg shadow-indigo-500/20 hover:scale-[1.01]'
                                  : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-50 pointer-events-none'
                              }`}
                            >
                              {isSubmittingRecruiter ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                                  <span>Setting up enterprise account...</span>
                                </>
                              ) : (
                                <span>Complete Registration & Access Dashboard →</span>
                              )}
                            </button>
                          </div>

                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* SECTION B: VALUE PROPOSITIONS & HERO COPY (ORDER 2 ON MOBILE, LEFT COL ON DESKTOP) */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="w-full order-2 lg:order-1 lg:col-span-5 space-y-6"
            >
              <div>
                <span className="text-xs font-mono font-bold text-[#38bdf8] uppercase tracking-wider block">
                  {selectedRole === 'recruiter' ? 'RECRUITER & ENTERPRISE PORTAL' : 'CANDIDATE ONBOARDING'}
                </span>

                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mt-2">
                  {selectedRole === 'recruiter' ? 'Automate Your Technical Hiring' : 'Start Your AI Technical Interview'}
                </h1>

                <p className="text-sm text-[#94a3b8] leading-relaxed font-normal mt-2">
                  {selectedRole === 'recruiter'
                    ? 'Conduct structured, unbiased first-round technical interviews at scale without scheduling fatigue.'
                    : 'Practice or interview anytime in a comfortable, pressure-free environment with personalized, real-time feedback.'}
                </p>
              </div>

              {/* Dynamic Trust Badges */}
              <div className="space-y-3.5 pt-2">
                <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <CheckCircle className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Objective & Fair Skill Evaluation</h3>
                    <p className="text-xs text-[#94a3b8]">Every applicant is evaluated strictly on merit and core skills.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <ShieldCheck className="w-5 h-5 text-[#38bdf8] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Safe & Encrypted Video Sessions</h3>
                    <p className="text-xs text-[#94a3b8]">Bank-grade encryption ensures your video recordings and data remain private.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <Zap className="w-5 h-5 text-[#818cf8] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-white">Instant Candidate Scorecard Delivery</h3>
                    <p className="text-xs text-[#94a3b8]">Get verifiable evaluation dossiers and performance reports within seconds.</p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </main>
      </div>
    </div>
  );
}
