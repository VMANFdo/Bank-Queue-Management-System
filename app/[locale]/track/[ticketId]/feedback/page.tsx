"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Star } from "lucide-react";
import { Link } from "@/i18n/routing";

const FEEDBACK_TAGS = [
  { key: "fast_service", label: "Fast Service" },
  { key: "friendly_staff", label: "Friendly Staff" },
  { key: "clean_environment", label: "Clean Environment" },
  { key: "clear_process", label: "Clear Process" },
  { key: "minimal_wait", label: "Minimal Wait" },
  { key: "professional", label: "Professional" },
];

export default function FeedbackPage({
  params,
}: {
  params: Promise<{ ticketId: string; locale: string }>;
}) {
  const { ticketId } = use(params);
  const t = useTranslations("feedback");

  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (key: string) => {
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const submitFeedback = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          rating,
          tags: selectedTags,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Failed to submit feedback");
      }
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Success animation */}
          <div className="relative inline-flex">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl animate-pulse" />
            <div className="relative p-6 rounded-full bg-emerald-500/10 border border-emerald-500/30">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-zinc-100">{t("thankYou")}</h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              Your feedback helps us improve the experience at every branch.
            </p>
          </div>

          {/* Star display */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-8 h-8 transition-colors ${
                  star <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-700"
                }`}
              />
            ))}
          </div>

          <div className="space-y-3">
            <Link
              href="/"
              className="flex items-center justify-center w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition-colors min-h-[56px]"
            >
              Back to Home
            </Link>
            <Link
              href="/select-bank"
              className="flex items-center justify-center w-full py-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-semibold text-base transition-colors min-h-[56px]"
            >
              Find Another Branch
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-emerald-500/5 blur-[100px] pointer-events-none" />

      <main className="relative max-w-lg mx-auto px-4 py-12 space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <Star className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-zinc-400">
            Share your experience to help us serve Sri Lanka better.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Star Rating */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-zinc-200">{t("rating")}</h2>
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                id={`rating-star-${star}`}
                aria-label={`Rate ${star} out of 5 stars`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="group relative p-2 rounded-xl transition-transform hover:scale-110 active:scale-95 min-h-[60px] min-w-[60px] flex items-center justify-center"
              >
                <Star
                  className={`w-10 h-10 transition-colors duration-150 ${
                    star <= (hoveredRating || rating)
                      ? "text-amber-400 fill-amber-400"
                      : "text-zinc-600 group-hover:text-zinc-400"
                  }`}
                />
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-zinc-400 animate-in fade-in duration-300">
              {rating === 5 ? "Excellent! 🎉" :
               rating === 4 ? "Great!" :
               rating === 3 ? "Good" :
               rating === 2 ? "Needs improvement" :
               "Poor experience"}
            </p>
          )}
        </section>

        {/* Feedback Tags */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-zinc-200">{t("tags")}</h2>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  id={`feedback-tag-${tag.key}`}
                  onClick={() => toggleTag(tag.key)}
                  className={`px-4 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 min-h-[44px] ${
                    isSelected
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                      : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {isSelected && <span className="mr-1.5">✓</span>}
                  {tag.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Comment */}
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">{t("comment")}</h2>
            <span className="text-xs text-zinc-500">{comment.length}/200</span>
          </div>
          <textarea
            id="feedback-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 200))}
            placeholder="Tell us about your visit…"
            rows={4}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-4 py-3 text-zinc-100 placeholder-zinc-600 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-shadow"
          />
        </section>

        {/* Submit */}
        <button
          type="button"
          id="feedback-submit"
          disabled={rating === 0 || submitting}
          onClick={submitFeedback}
          className="flex min-h-[60px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-6 text-lg font-semibold text-white transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 shadow-lg shadow-emerald-600/20"
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Star className="h-5 w-5" />
              {t("submit")}
            </>
          )}
        </button>

        {rating === 0 && (
          <p className="text-center text-xs text-zinc-500">
            Please select a star rating to submit
          </p>
        )}

        <Link
          href="/"
          className="block text-center text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-2"
        >
          Skip for now
        </Link>
      </main>
    </div>
  );
}
