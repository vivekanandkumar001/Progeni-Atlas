'use client';

import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  X,
  QrCode,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  MayankUpiOrderResponse,
  checkMayankUpiStatus,
  submitMayankUpiUtr,
} from '@/lib/mayank_upi';

interface MayankUpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: MayankUpiOrderResponse | null;
  onSuccess: (data: { message: string; creditsAdded: number; paymentId: string }) => void;
}

export const MayankUpiModal: React.FC<MayankUpiModalProps> = ({
  isOpen,
  onClose,
  orderData,
  onSuccess,
}) => {
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedOrder, setCopiedOrder] = useState(false);
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [utrError, setUtrError] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<'listening' | 'verified' | 'failed'>('listening');
  const [showUtrField, setShowUtrField] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fallback defaults to ensure nothing is ever blank on screen
  const displayAmount =
    orderData?.amount_inr ||
    orderData?.amount_credits ||
    0;

  const upiId = orderData?.upi_id || 'progeniatlas@okaxis';
  const payeeName = orderData?.payee_name || 'Progeni Atlas';
  const orderRef = orderData?.order_id || 'ORDER';

  const upiIntentUri =
    orderData?.upi_intent ||
    `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${displayAmount.toFixed(2)}&cu=INR&tr=${encodeURIComponent(orderRef)}&tn=${encodeURIComponent('Progeni Atlas Credits')}`;

  const qrValue = orderData?.qr_data || upiIntentUri;

  // Auto-polling for real-time payment confirmation
  useEffect(() => {
    if (!isOpen || !orderData?.order_id || pollingStatus === 'verified') {
      return;
    }

    const poll = async () => {
      try {
        const res = await checkMayankUpiStatus(orderData.order_id);
        if (res.success && res.status === 'paid') {
          setPollingStatus('verified');
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setTimeout(() => {
            onSuccess({
              message: `Payment of ₹${displayAmount} confirmed! ${orderData.amount_credits} credits added.`,
              creditsAdded: orderData.amount_credits,
              paymentId: orderData.order_id,
            });
            onClose();
          }, 1200);
        }
      } catch {
        // Continue polling silently
      }
    };

    pollTimerRef.current = setInterval(poll, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, orderData, pollingStatus, displayAmount, onSuccess, onClose]);

  if (!isOpen || !orderData) return null;

  const handleCopyUpi = () => {
    if (upiId) {
      navigator.clipboard.writeText(upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleCopyOrder = () => {
    if (orderRef) {
      navigator.clipboard.writeText(orderRef);
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 2000);
    }
  };

  const handleDirectUpiIntent = () => {
    if (upiIntentUri) {
      window.location.href = upiIntentUri;
    }
  };

  const handleUtrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!utrInput.trim()) {
      setUtrError('Please enter the 12-digit UPI reference / UTR number.');
      return;
    }
    setSubmittingUtr(true);
    setUtrError(null);

    try {
      const res = await submitMayankUpiUtr({
        orderId: orderData.order_id,
        utr: utrInput.trim(),
        amountCredits: orderData.amount_credits,
        amountInr: displayAmount,
      });

      if (res.success) {
        setPollingStatus('verified');
        setTimeout(() => {
          onSuccess({
            message: res.message || `Payment verified! ${orderData.amount_credits} credits added.`,
            creditsAdded: res.credits_added || orderData.amount_credits,
            paymentId: utrInput.trim(),
          });
          onClose();
        }, 800);
      } else {
        setUtrError(res.error || 'Failed to verify UTR number.');
      }
    } catch (err) {
      setUtrError(err instanceof Error ? err.message : 'Failed to submit UTR.');
    } finally {
      setSubmittingUtr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md rounded-3xl bg-surface border border-line shadow-2xl overflow-hidden transition-all text-ink">
        
        {/* Top Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-line bg-gradient-to-r from-blue-50/50 via-surface to-indigo-50/40">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#185adb] text-white shadow-md shadow-blue-500/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-ink flex items-center gap-1.5">
                Scan &amp; Pay with UPI
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-[#185adb] font-bold border border-blue-500/20">
                  Instant
                </span>
              </h3>
              <p className="text-xs text-ink-muted">
                Google Pay · PhonePe · Paytm · BHIM · Cred
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          
          {/* Order Details Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/15">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#185adb]">Total Payable</p>
              <p className="text-2xl font-black text-[#072448]">₹{displayAmount}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-accent-emerald border border-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                +{orderData.amount_credits} Credits
              </span>
              <p className="text-[10px] text-ink-muted font-mono mt-1">Ref: {orderRef.slice(-8)}</p>
            </div>
          </div>

          {/* QR Code Canvas */}
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative p-3.5 rounded-2xl bg-white border-2 border-[#185adb]/30 shadow-lg shadow-blue-500/5">
              <QRCodeSVG
                value={qrValue}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs font-medium text-ink-muted text-center">
              Scan with any UPI app on your phone to complete payment
            </p>
          </div>

          {/* Real-time Listening Pulse */}
          <div className="flex items-center justify-center gap-2 p-2.5 rounded-xl bg-surface-2 border border-line text-xs font-semibold">
            {pollingStatus === 'verified' ? (
              <span className="flex items-center gap-2 text-emerald-600 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Payment Confirmed! Adding credits...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-ink-muted">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
                </span>
                Waiting for payment confirmation...
              </span>
            )}
          </div>

          {/* 1-Click Pay on Mobile (UPI Intent) */}
          <button
            type="button"
            onClick={handleDirectUpiIntent}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#072448] via-[#185adb] to-[#0284c7] text-white font-bold text-sm shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            Open Directly in UPI App (GPay / PhonePe)
          </button>

          {/* UPI ID Copy Field */}
          <div className="p-3 rounded-xl bg-surface-2 border border-line flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] text-ink-muted uppercase block font-semibold">Payee UPI ID</span>
              <span className="font-mono font-bold text-ink">{upiId}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyUpi}
              className="px-2.5 py-1 rounded-lg border border-line bg-surface hover:bg-surface-3 transition text-xs font-medium flex items-center gap-1 cursor-pointer"
            >
              {copiedUpi ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" /> Copy ID
                </>
              )}
            </button>
          </div>

          {/* Fallback UTR Submission Accordion */}
          <div className="border-t border-line pt-3">
            {!showUtrField ? (
              <button
                type="button"
                onClick={() => setShowUtrField(true)}
                className="text-xs text-[#185adb] hover:underline font-semibold flex items-center justify-center gap-1 w-full text-center cursor-pointer"
              >
                Already paid on your app? Submit 12-digit UTR <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <form onSubmit={handleUtrSubmit} className="space-y-2.5 animate-fadeIn">
                <label className="text-[11px] font-bold text-ink-muted uppercase block">
                  Enter 12-digit UPI Reference (UTR) No.
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    placeholder="e.g. 431289102934"
                    maxLength={24}
                    className="flex-1 px-3 py-2 rounded-xl border border-line bg-surface text-xs font-mono text-ink focus:outline-none focus:border-[#185adb]"
                  />
                  <button
                    type="submit"
                    disabled={submittingUtr}
                    className="px-4 py-2 rounded-xl bg-[#185adb] text-white font-bold text-xs hover:bg-[#154bb7] disabled:opacity-50 transition cursor-pointer shrink-0"
                  >
                    {submittingUtr ? 'Verifying...' : 'Verify UTR'}
                  </button>
                </div>
                {utrError && (
                  <p className="text-[11px] text-rose-500 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {utrError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Footer Security Strip */}
        <div className="px-6 py-3 bg-surface-2 border-t border-line flex items-center justify-between text-[11px] text-ink-muted">
          <span className="flex items-center gap-1.5 font-medium text-emerald-600">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Verified UPI Gateway
          </span>
          <span className="font-mono text-[10px] text-ink-muted">Instant 24/7 Automated Credit</span>
        </div>
      </div>
    </div>
  );
};
