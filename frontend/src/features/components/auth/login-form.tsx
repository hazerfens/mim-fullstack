"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";



import { zodResolver } from "@hookform/resolvers/zod";
import { LoginFormSchema, LoginFormValues } from "@/features/validators/login-schema";
import { CardWrapper } from "./card-wrapper";
import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";
import { loginAction } from "@/features/actions/auth-action";
import { toast } from "sonner";
import { useSession } from "@/components/providers/session-provider";
import { useLoginClient } from '@/stores/session-store';


export const LoginForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Component artık sadece 'login' fonksiyonunu biliyor.
  

  // Preserve callbackUrl or invitation_token flow
  const callbackUrl = searchParams.get("callbackUrl");
  const invitationToken = searchParams.get("invitation_token");
  const invitationEmail = searchParams.get("email");

  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);
  const { refreshSession } = useSession();
  const applyLoginResult = useLoginClient();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(LoginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // onSubmit fonksiyonu artık çok daha temiz.
  const onSubmit = async (values: LoginFormValues) => {
    setError("");
    setSuccess("");
    setIsPending(true);

    try {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);

      // Tek bir çağrı ile tüm login süreci yönetiliyor.
      const result = await loginAction(formData);

      if (result.status === "success") {
        setSuccess("Başarıyla giriş yaptınız! Yönlendiriliyorsunuz...");
        toast.success("Giriş başarılı!");
        // Apply server-returned user quickly into client store for immediate
        // UI responsiveness, then trigger a full refresh to pick up server
        // side cookies and authoritative state.
        try {
          applyLoginResult(result.user ?? null);
        } catch {}
        await refreshSession();
        if (invitationToken) {
          // After login, redirect back to invitation acceptance page
          router.push(`/accept-invitation/${invitationToken}`);
        } else {
          router.push(callbackUrl || "/");
        }
      } else {
        setError(result.message || "Hatalı giriş");
        toast.error(result.message || "Hatalı giriş");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <CardWrapper
      headerLabel="Hoşgeldiniz..."
      backButtonLabel="Yeni hesap oluştur?"
      backButtonHref={invitationToken ? `/auth/register?invitation_token=${invitationToken}&email=${invitationEmail || ''}` : "/auth/register"}
      showSocial
      socialCallbackUrl={invitationToken ? `/accept-invitation/${invitationToken}` : (callbackUrl || "/")}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      defaultValue={invitationEmail ?? undefined}
                      disabled={isPending}
                      placeholder="E-Posta adresiniz"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      placeholder="******"
                      disabled={isPending}
                    />
                  </FormControl>
                  <Button size={"sm"} variant={"link"}>
                    <Link href="/auth/reset">Şifremi Unuttum!</Link>
                  </Button>
                </FormItem>
              )}
            />
          </div>
          <FormError message={error} />
          <FormSuccess message={success} />

          <Button
            disabled={isPending}
            className="w-full"
            type="submit"
            variant="secondary"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>Giriş Yap</>
            )}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};