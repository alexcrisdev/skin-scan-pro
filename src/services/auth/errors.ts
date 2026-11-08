type AuthFailure = { code?: string; status?: number };

export function authErrorMessage(error: AuthFailure, fallback: string): string {
  switch (error.code) {
    case "email_not_confirmed":
      return "Tu cuenta aún no está habilitada. Contacta al responsable de SkinScan.";
    case "invalid_credentials":
      return "El correo o la contraseña no son correctos.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Se alcanzó el límite de intentos o de envío de correos. Inténtalo más tarde.";
    case "email_address_not_authorized":
      return "El envío de correos no está habilitado para esta dirección. Contacta al responsable de SkinScan.";
    default:
      return error.status && error.status >= 500
        ? "El servicio de acceso no está disponible. Inténtalo nuevamente."
        : fallback;
  }
}
