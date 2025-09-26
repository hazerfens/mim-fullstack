import { Poppins } from "next/font/google";

import { cn } from "@/lib/utils";

import Link from "next/link";
import Image from "next/image";

const font = Poppins({
  subsets: ["latin"],
  weight: ["600"],
});

interface HeaderProps {
  label: string;
}

export const Header = ({ label }: HeaderProps) => {
  return (
    <div className="w-full flex flex-col gap-y-4 items-center justify-center">
      <h1 className={cn("text-3xl font-semibold", font.className)}>
        <Link href="/" title="Ana Sayfa">
        <div className="relative h-10 w-56 rounded-lg flex items-center dark:text-neutral-500 transition justify-center cursor-pointer dark:hover:text-neutral-400">
          {/* <Image src="/logo.svg" alt="Logo" fill className="object-contain" /> */}
        </div>
        </Link>
      </h1>
      <p className="text-muted-foreground font-semibold">{label}</p>
    </div>
  );
};