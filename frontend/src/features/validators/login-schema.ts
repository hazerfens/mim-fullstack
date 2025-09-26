import * as zod from "zod";

export const LoginFormSchema = zod.object({
  email: zod.string().email(),
  password: zod.string().min(6),
});

export const ResetFormValuesSchema = zod.object({
  email: zod.string().email(),
});

export type LoginFormValues = {
  email: string;
  password: string;
};
export type ResetFormValues = {
  email: string;
};
export type ResetPasswordValues = {
  password: string;
};

export const NewPasswordFormSchema = zod.object({
  password: zod.string().min(6),
});


export const RegisterFormSchema = zod.object({
  name: zod.string(),

  email: zod.string().email(),
  password: zod.string().min(6),
});

export type RegisterFormValues = {
  email: string;
  name: string;
  password: string;
};