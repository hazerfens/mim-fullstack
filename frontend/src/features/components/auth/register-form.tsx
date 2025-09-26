"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from 'next/navigation';

import {zodResolver} from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

import { Button } from "@/components/ui/button";

import { Loader2 } from "lucide-react";

import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";

import { CardWrapper } from "./card-wrapper";
import { RegisterFormSchema, RegisterFormValues } from "@/features/validators/login-schema";
import { registerAction } from "@/features/actions/auth-action";


export const RegisterForm = () => {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState<string | undefined>("");
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const form = useForm({
    resolver: zodResolver(RegisterFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setError("");
    setSuccess("");
    setIsPending(true);

    try {
      // FormData oluştur
      const formData = new FormData();
      formData.append("name", values.name);
      formData.append("email", values.email);
      formData.append("password", values.password);
      // registerAction fonksiyonunu doğrudan bir API Route veya Server Action üzerinden çağırmalısınız
      // Eğer doğrudan client'tan çağırıyorsanız, cookies hatası alırsınız
      // Doğru kullanım için: /api/auth/register endpointine fetch ile POST atın
      const res = await registerAction(formData);
      

      if (res.status === "error") {
        setError(res.message || "Kayıt başarısız oldu.");
      } else {
        setSuccess("Kayıt başarılı! Giriş sayfasına yönlendiriliyorsunuz...");
        setTimeout(() => {
          router.push("/auth/login");
        }, 1000);
      }
    } catch {
      setError("Kayıt işlemi sırasında bir hata oluştu.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <CardWrapper
      headerLabel="Kullanıcı hesabı oluşturun"
      backButtonLabel="Hesabınız var mı?"
      backButtonHref="/auth/login"
      showSocial
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4 dark:text-neutral-600">
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adınız Soyadınız</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      
                      type="text"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Posta Adresiniz</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="bilgi@mimreklam.com.tr"
                      type="email"
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
                  <FormLabel>Şifreniz</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={isPending}
                      placeholder="******"
                      type="password"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button
            disabled={isPending}
            type="submit"
            className="w-full"
            variant="secondary"
          >
            {!isPending ? (
              <>Kayıt Oluştur</>
            ) : (
              <Loader2 className="w-3 h-3 animate-spin " />
            )}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};