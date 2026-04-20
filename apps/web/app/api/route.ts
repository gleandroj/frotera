import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Frotera API is running",
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    endpoints: {
      public: {
        health: "/api/health",
      },
      protected: {},
    },
    authentication: {},
  });
}
