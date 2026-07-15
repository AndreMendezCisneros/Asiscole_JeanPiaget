import { Toaster as Sonner, toast } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      expand
      visibleToasts={4}
      duration={3200}
      closeButton
      offset={20}
      gap={12}
      className="staff-toaster"
      toastOptions={{
        classNames: {
          toast: 'staff-toast',
          title: 'staff-toast__title',
          description: 'staff-toast__description',
          success: 'staff-toast--success',
          error: 'staff-toast--error',
          warning: 'staff-toast--warning',
          info: 'staff-toast--info',
          closeButton: 'staff-toast__close',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
