import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "react-i18next";
import { LogIn, AlertCircle, ShieldCheck, ArrowRight } from "lucide-react";
import { authApi } from "../api";
import { useAuthStore } from "../store";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    setServerError(null);
    try {
      const data = await authApi.login(values);
      setAuth(data.user, data.access_token);

      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      const needsKyc =
        (data.user.role === "FACTORY" || data.user.role === "BUYER") &&
        data.user.company?.verification_status !== "APPROVED";
      if (needsKyc) {
        navigate("/approval-pending", { replace: true });
      } else if (from) {
        navigate(from, { replace: true });
      } else if (data.user.role === "FACTORY") {
        navigate("/factory/dashboard", { replace: true });
      } else if (data.user.role === "HUB_STAFF") {
        navigate("/hub/queue", { replace: true });
      } else if (data.user.role === "ADMIN") {
        navigate("/admin/kyc", { replace: true });
      } else {
        navigate("/catalog", { replace: true });
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || "Invalid credentials or network failure.";
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-card p-8 rounded-2xl shadow-xl border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t("auth.signInTitle")}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.signInSubtitle")}
          </p>
        </div>

        {serverError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {t("auth.emailLabel")}
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="name@company.com"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-foreground">
                  {t("auth.passwordLabel")}
                </label>
              </div>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:outline-none transition-all text-sm"
              />
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium text-primary-foreground bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <span>{t("common.loading")}</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{t("auth.submitSignIn")}</span>
              </>
            )}
          </button>

          <div className="text-center text-sm text-muted-foreground pt-4 border-t border-border">
            <span>{t("auth.noAccount")} </span>
            <Link
              to="/register"
              className="font-semibold text-primary hover:underline inline-flex items-center gap-1"
            >
              {t("nav.register")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
