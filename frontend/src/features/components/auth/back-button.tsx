"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

interface BackButtonProps {
  href: string;
  label: string;
};

export const BackButton = ({
  href,
  label,
}: BackButtonProps) => {
  return (
    <Button
      variant="link"
      className="font-xs w-full"
      size="sm"
      asChild
    >
      <Link href={href}>
       <p className="dark:text-neutral-500">
        
        {label}
        </p> 
      </Link>
    </Button>
  );
};