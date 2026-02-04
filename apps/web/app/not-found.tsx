"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/i18n/useTranslation"

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-6xl font-bold text-muted-foreground mb-4">404</CardTitle>
          <CardTitle>{t('errors.pageNotFound')}</CardTitle>
          <CardDescription>{t('errors.pageNotFoundDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Link href="/">
              <Button className="w-full">{t('errors.goHome')}</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                {t('errors.signIn')}
              </Button>
            </Link>
            <Link href="/troubleshoot">
              <Button variant="ghost" className="w-full">
                {t('errors.systemDiagnostics')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
