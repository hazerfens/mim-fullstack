"use client";

import { 
  Card,
  CardContent,
  CardFooter,
  CardHeader
} from "@/components/ui/card";



import { BackButton } from "./back-button";
import { SocialAuthButton } from "./social-button";
import { Header } from "./header";



interface CardWrapperProps {
  children: React.ReactNode;
  headerLabel: string;
  backButtonLabel: string;
  backButtonHref: string;
  showSocial?: boolean;
};

export const CardWrapper = ({
  children,
  headerLabel,
  backButtonLabel,
  backButtonHref,
  showSocial 
}: CardWrapperProps) => {
  return (
    <Card className="w-[90%] sm:w-[360px] lg:w-[340px] xl:w-[380px] shadow-md">
      <CardHeader>
        <Header label={headerLabel} />
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
      {showSocial && (
        <CardFooter className="flex flex-col gap-2">
          <SocialAuthButton provider="google" />
          <SocialAuthButton provider="github" />
        </CardFooter>
      )}
      <CardFooter>
      <BackButton
          label={backButtonLabel}
          href={backButtonHref}
        />
      </CardFooter>
    </Card>
  );
};