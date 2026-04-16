import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/icons/logo";
import { getPublicConfig } from "@/lib/api/config";
import { getServerTranslation } from "@/lib/i18n-server";

type PageProps = {
  searchParams: Promise<{ redirect?: string; signup?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const [config, { t }, params] = await Promise.all([
    getPublicConfig(),
    getServerTranslation(),
    searchParams,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:flex-1 lg:flex-col lg:justify-center lg:px-20 xl:px-24 bg-gradient-to-br from-blue-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10">
          <div className="flex items-center mb-8">
            <Logo variant="light" size="lg" showTagline />
          </div>
          <div className="space-y-6 text-white">
            <h2 className="text-4xl font-bold leading-tight">
              {t("auth.branding.login.heroTitle")}
            </h2>
            <p className="text-xl text-blue-100 leading-relaxed">
              {t("auth.branding.login.heroDescription")}
            </p>
            <div className="grid grid-cols-1 gap-4 pt-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">{t("auth.branding.login.features.support247")}</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">{t("auth.branding.login.features.multiPlatform")}</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-lg">{t("auth.branding.login.features.analytics")}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-12">
          <div className="w-96 h-96 bg-white/5 rounded-full"></div>
        </div>
        <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12">
          <div className="w-64 h-64 bg-white/5 rounded-full"></div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-20 xl:px-24">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div className="lg:hidden mb-8">
            <div className="flex items-center justify-center mb-6">
              <Logo variant="auto" size="md" />
            </div>
          </div>
          <AuthForm
            signupEnabled={config.signupEnabled ?? false}
            redirect={params.redirect ?? undefined}
            signupDisabledParam={params.signup ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}
