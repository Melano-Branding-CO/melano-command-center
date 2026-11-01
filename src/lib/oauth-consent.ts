import { supabase } from "@/integrations/supabase/client";

export type AuthorizationDetails = {
  client?: { name?: string; client_name?: string };
  redirect_uri?: string;
  scopes?: string[];
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthSdk = {
  getAuthorizationDetails(id: string): Promise<OAuthResult>;
  approveAuthorization(id: string): Promise<OAuthResult>;
  denyAuthorization(id: string): Promise<OAuthResult>;
};
export const oauth = (supabase.auth as unknown as { oauth: OAuthSdk }).oauth;