"use client";

import { useForm } from "react-hook-form";
import { useState} from "react";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import { zodResolver } from "@hookform/resolvers/zod";

import { CardWrapper } from "./card-wrapper";
import { FormError } from "./form-error";
import { FormSuccess } from "./form-success";
import { ResetFormValues, ResetFormValuesSchema } from "@/features/validators/login-schema";
import { resetAction } from "@/features/actions/auth-action";
import { toast } from "sonner";







export const ResetForm = () => {
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();
  const [isPending, setIsPending] = useState<boolean>(false);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(ResetFormValuesSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ResetFormValues) => {
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.append("email", values.email);


      // Tek bir çağrı ile tüm login süreci yönetiliyor.
      const result = await resetAction(formData);

      if (result.status === "success") {
        setSuccess("Başarıyla giriş yaptınız! Yönlendiriliyorsunuz...");
        // Context, state'i zaten güncellediği için doğrudan yönlendirme yapabiliriz.
        toast.success("Giriş başarılı!");
       
      } else {
        setError(result.message || "Hatalı giriş");
        toast.error(result.message || "Hatalı giriş");
      }
    } finally {
      setIsPending(false);
    }
    form.reset();
  };

  return (
    <CardWrapper
      headerLabel="Şifrenizi yenileyin!..."
      backButtonLabel="Giriş Sayfası"
      backButtonHref="/auth/login"
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
                      disabled={isPending}
                      placeholder="E-Posta adresiniz"
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
              <>Yenileme Linki Gönder</>
            )}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
};