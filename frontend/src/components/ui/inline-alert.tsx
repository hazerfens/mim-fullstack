import React from 'react';
import { Alert, AlertTitle, AlertDescription } from './alert';

interface Props {
  variant?: 'default' | 'destructive';
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export default function InlineAlert({ variant = 'default', title, description, icon, className }: Props) {
  return (
    <Alert variant={variant} className={className}>
      {icon}
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  );
}
