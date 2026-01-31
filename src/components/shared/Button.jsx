import { cn } from '../../utils/helpers';

export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  disabled,
  ...props 
}) => {
  const baseStyles = 'font-medium rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-brand-primary hover:bg-brand-hover text-white',
    secondary: 'bg-dark-input hover:bg-dark-hover text-dark-text',
    danger: 'bg-admin hover:bg-admin/80 text-white',
    ghost: 'hover:bg-dark-hover text-dark-text',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  
  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
