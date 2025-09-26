"use client";

import { useForm } from "react-hook-form";
import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";



import { useSearchParams } from "next/navigation";

import { CardWrapper } from "./card-wrapper";
import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";

import { zodResolver } from "@hookform/resolvers/zod";
import { NewPasswordFormSchema, ResetPasswordValues } from "@/features/validators/login-schema";
import { newPassword } from "@/features/actions/auth-action";




export const NewPasswordForm = () => {

    const searchParams = useSearchParams()
    const token = searchParams.get('token')
    console.log("Tokenz:", token);
    
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(NewPasswordFormSchema),
    defaultValues: {
      password: "",
    },
  });

  const onSubmit = async (values: ResetPasswordValues) => {
    setError("");
    setSuccess("");

    console.log(values);
    

    startTransition(async () => {
      newPassword(values, token)
      .then((data) => {
        setError(data?.error);
        setSuccess(data?.success);
      })
    });
  };

  return (
    <CardWrapper
      headerLabel="Yeni şifrenizi giriniz!..."
      backButtonLabel="Giriş Sayfası"
      backButtonHref="/auth/login"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      disabled={isPending}
                      placeholder="Yeni Şifreniz"
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
            className="w-full"
            type="submit"
            variant="secondary"
          >
            {isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>Şifreyi Yenile</>
            )}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};