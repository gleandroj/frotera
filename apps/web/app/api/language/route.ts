import { cookieName, languages, fallbackLanguage } from "@/i18n/settings";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { language } = body;

    // Validate the language code
    if (!language || typeof language !== "string") {
      return NextResponse.json(
        { error: "Language code is required and must be a string" },
        { status: 400 }
      );
    }

    // Check if the language is supported, fallback to "pt" if not
    const validLanguage = languages.includes(language) ? language : fallbackLanguage;

    if (!languages.includes(language)) {
      console.warn(`Language '${language}' is not supported, falling back to '${fallbackLanguage}'`);
    }

    // Set the language cookie
    const cookieStore = await cookies();
    cookieStore.set(cookieName, validLanguage, {
      httpOnly: false, // Allow client-side access
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    return NextResponse.json(
      { message: "Language updated successfully", language: validLanguage },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating language:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
