import React, { useState } from 'react';
import { X, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';

interface PasswordVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

const PasswordVerifyModal: React.FC<PasswordVerifyModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  title = "操作验证"
}) => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const verifyPassword = useStore((state) => state.verifyPassword);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await verifyPassword(password);
    if (result.success) {
      onSuccess();
      onClose();
      setPassword('');
    } else {
      setError(result.message || '密码错误，请重新输入');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="p-6 bg-blue-600 text-white flex flex-col items-center text-center">
          <div className="p-3 bg-white/20 rounded-2xl mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="text-blue-100 text-sm mt-1">请输入当前账户密码以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center">
              {error}
            </div>
          )}

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              autoFocus
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="账户密码"
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                setPassword('');
                setError('');
              }}
              className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
            <button
              disabled={loading}
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : '确认'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordVerifyModal;
