"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import Image from 'next/image'

import { cn } from "@/lib/utils"

function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        "relative flex size-8 shrink-0 overflow-hidden rounded-full",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  src,
  alt,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image> & { src?: string | null; alt?: string }) {
  const [errored, setErrored] = React.useState(false);

  // If no src or we failed loading, do not render an image so the Radix
  // AvatarFallback can be shown by the consumer.
  if (!src || errored) return null;

  const isRemote = /^https?:\/\//i.test(src);

  if (isRemote) {
    return (
      // Next/Image with fill requires the parent to be positioned; the
      // Avatar root is already relative so this will fill it.
      <div data-slot="avatar-image" className={cn("absolute inset-0", className)}>
        <Image
          src={src}
          alt={alt ?? ''}
          fill
          sizes="48px"
          className="object-cover"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={src}
      alt={alt}
      {...props}
      onError={() => setErrored(true)}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        className
      )}
      {...props}
    />
  )
}

export { Avatar, AvatarImage, AvatarFallback }
