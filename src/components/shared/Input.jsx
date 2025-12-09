import { cn } from '../../utils/helpers';

export const Input = ({ 
  label, 
  error, 
  className,
  containerClassName,
  ...props 
}) => {
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label className="text-sm font-medium text-dark-text">
          {label}
        </label>
      )}
      <input
        className={cn(
          'bg-dark-input text-dark-text px-4 py-2.5 rounded-md',
          'border border-transparent focus:border-brand-primary',
          'outline-none transition-colors duration-200',
          'placeholder:text-dark-muted',
          error && 'border-admin',
          className
        )}
        {...props}
      />
      {error && (
        <span className="text-sm text-admin">{error}</span>
      )}
    </div>
  );
};
