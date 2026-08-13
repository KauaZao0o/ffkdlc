import jwt from "jsonwebtoken";

const COOKIE_NAME = "token";

export function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

// Lê o userId a partir do cookie httpOnly da requisição (App Router).
export function getUserIdFromRequest(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  return payload?.userId || null;
}

// Configura o cookie de sessão numa resposta (NextResponse).
export function setAuthCookie(response, token) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 dias
  });
}

export function clearAuthCookie(response) {
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}
