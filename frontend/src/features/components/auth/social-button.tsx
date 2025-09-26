import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { FaGithub, FaFacebook, FaApple } from "react-icons/fa";

import React from "react";


const providerIcons: Record<string, React.ReactNode> = {
  google: <FcGoogle className="mr-2 h-4 w-4" />,
  github: <FaGithub className="mr-2 h-4 w-4" />,
  facebook: <FaFacebook className="mr-2 h-4 w-4" />,
  apple: <FaApple className="mr-2 h-4 w-4" />,
};

export interface SocialAuthButtonProps {
  provider: "google" | "github" | "facebook" | "apple";
  label?: string;
  callbackURL?: string;
}

export function SocialAuthButton({ provider, label, callbackURL = "/dashboard" }: SocialAuthButtonProps) {
  const handleSocialLogin = () => {
    // Doğrudan backend endpointine yönlendir
    const apiUrl = process.env.BACKEND_URL || "http://localhost:3333";
    window.location.href = `${apiUrl}/auth/${provider}?callbackUrl=${encodeURIComponent(callbackURL)}`;
  };

  return (
    <Button
      onClick={handleSocialLogin}
      variant="outline"
      className="w-full"
      type="button"
    >
      {providerIcons[provider]}
      {label || `Sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}`}
    </Button>
  );
}