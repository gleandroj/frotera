"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { setLanguageCookie } from "@/lib/language-utils";
import { authAPI } from "@/lib/frontend/api-client";
import { useAuth } from "@/lib/hooks/use-auth";
import { Check, Languages } from "lucide-react";
import { useCallback } from "react";
import { languages as supportedLanguages, fallbackLanguage } from "@/i18n/settings";

// Display options for the language selector (only supported languages from i18n/settings)
const languageOptions: { code: string; name: string; flag: string }[] = [
  { code: "pt", name: "Português (BR)", flag: "🇧🇷" },
].filter((lang) => supportedLanguages.includes(lang.code));

export function LanguageSwitcherLink() {
  const { t, i18n, currentLanguage } = useTranslation()
  const { isAuthenticated, refreshUser } = useAuth()

  const handleLanguageChange = useCallback(
    async (language: string) => {
      // Validate language and fallback to "pt" if not available
      const validLanguage = supportedLanguages.includes(language) ? language : fallbackLanguage;

      if (currentLanguage === validLanguage) return;

      try {
        // First, set the cookie via API to ensure server-side consistency
        await setLanguageCookie(validLanguage);

        // If user is authenticated, update their language preference in the database
        if (isAuthenticated) {
          try {
            await authAPI.updateLanguage(validLanguage);
            // Refresh user data to reflect the updated language preference
            await refreshUser();
          } catch (error) {
            console.error('Error updating user language preference:', error);
            // Continue with language change even if API call fails
          }
        }

        // Then change language in i18next for immediate UI update
        await i18n.changeLanguage(validLanguage);

        // Refresh the page to ensure all server-rendered content (like page titles) updates immediately
        // For better UX, you could replace this with router.refresh() if you're using Next.js 13+ app router
        setTimeout(() => {
          window.location.reload();
        }, 100);

      } catch (error) {
        console.error('Error changing language:', error);
      }
    },
    [i18n, currentLanguage, isAuthenticated, refreshUser]
  )

  const currentLanguageData = languageOptions.find(lang => lang.code === currentLanguage)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label={t("language")}
          title={`${t("language")}: ${currentLanguage}`}
        >
          <Languages className="h-4 w-4" />
          {currentLanguageData?.flag}
          {/* <span className="hidden sm:inline">{currentLanguageData?.name}</span> */}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-[160px]">
        {languageOptions.map((lang) => {
          const isActive = currentLanguage === lang.code;
          return (
            <DropdownMenuItem
              key={lang.code}
              onSelect={async (e) => {
                if (isActive) {
                  e.preventDefault();
                  return;
                }

                // Prevent the dropdown from closing immediately
                e.preventDefault();

                // Handle the language change
                await handleLanguageChange(lang.code);
              }}
              className={cn(
                "flex items-center justify-between",
                !isActive && "cursor-pointer",
                isActive && "cursor-default"
              )}
            >
              <div className="flex items-center">
                <span className="mr-2">{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
