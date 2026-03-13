import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8020";

async function proxyRequest(request: NextRequest) {
  const url = new URL(request.url);
  // Ensure trailing slash for Django
  const pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  const targetUrl = `${BACKEND}${pathname}${url.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      init.body = await request.arrayBuffer();
    } else {
      init.body = await request.text();
    }
  }

  try {
    const res = await fetch(targetUrl, init);
    const body = await res.arrayBuffer();

    const responseHeaders = new Headers();
    res.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "transfer-encoding") {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(body, {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
    });
  } catch {
    return NextResponse.json(
      { detail: "Backend unavailable" },
      { status: 502 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
