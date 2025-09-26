import { TriangleAlertIcon } from "lucide-react";


interface FormErrorProps {
  message?: string;
};

export const FormError = ({
  message,
}: FormErrorProps) => {
  if (!message) return null;

  return (
    <div className="bg-destructive/15 font-medium p-3 rounded-md flex items-center gap-x-2 text-sm text-destructive dark:bg-orange-800 dark:text-orange-300">
      <TriangleAlertIcon className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
};