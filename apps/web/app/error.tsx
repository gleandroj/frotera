"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/i18n/useTranslation"

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useTranslation()

  useEffect(() => {
    console.error("Application error:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-red-600">{t('errors.somethingWentWrong')}</CardTitle>
          <CardDescription>{t('errors.applicationError')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-700 font-mono">{error.message}</p>
          </div>
          <div className="space-y-2">
            <Button onClick={reset} className="w-full">
              {t('errors.tryAgain')}
            </Button>
            <Button variant="outline" onClick={() => (window.location.href = "/")} className="w-full">
              {t('errors.goHome')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
