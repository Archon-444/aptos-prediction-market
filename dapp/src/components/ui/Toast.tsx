import React from 'react';
import { Toaster, toast as hotToast } from 'react-hot-toast';
import { FiCheckCircle, FiXCircle, FiAlertCircle, FiInfo } from 'react-icons/fi';

export const ToastProvider: React.FC = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#fff',
          color: '#1F2937',
          padding: '16px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          maxWidth: '500px',
          fontFamily: 'Inter, sans-serif',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#fff',
          },
          style: {
            border: '1px solid #10B981',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#fff',
          },
          style: {
            border: '1px solid #EF4444',
          },
        },
      }}
    />
  );
};

// Custom toast functions with icons
export const toast = {
  success: (message: string) => {
    hotToast.success(message, {
      icon: <FiCheckCircle className="w-5 h-5 text-success-500" />,
    });
  },

  error: (message: string) => {
    hotToast.error(message, {
      icon: <FiXCircle className="w-5 h-5 text-error-500" />,
    });
  },

  warning: (message: string) => {
    hotToast(message, {
      icon: <FiAlertCircle className="w-5 h-5 text-warning-500" />,
      style: {
        border: '1px solid #F59E0B',
      },
    });
  },

  info: (message: string) => {
    hotToast(message, {
      icon: <FiInfo className="w-5 h-5 text-blue-500" />,
      style: {
        border: '1px solid #3B82F6',
      },
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return hotToast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    });
  },

  loading: (message: string) => {
    return hotToast.loading(message);
  },

  dismiss: (toastId?: string) => {
    hotToast.dismiss(toastId);
  },
};

export default toast;
