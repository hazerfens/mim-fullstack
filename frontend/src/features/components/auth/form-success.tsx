import { TriangleAlertIcon } from "lucide-react";


interface FormSuccessProps {
  message?: string;
}

export const FormSuccess = ({ message }: FormSuccessProps) => {
  if (!message) return null;

  return (
    <div className="bg-emerald-300/15 font-medium p-3 rounded-md flex items-center gap-x-2 text-sm text-emerald-600 dark:bg-green-800 dark:text-green-300">
      <TriangleAlertIcon className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
};