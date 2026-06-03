import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  MoreVertical,
  Phone,
  IdCard,
  History,
  X,
  Trash2,
  Sparkles,
  Loader2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import PasswordVerifyModal from '../components/PasswordVerifyModal';
import AISearchToggle from '../components/AISearchToggle';
import { useAISearch } from '../hooks/useAISearch';

const Guests = () => {
  const { guests, fetchGuests, addGuest, updateGuest, deleteGuest } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<any>(null);

  // Verification states
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});

  // ─── AI: NL Search ───────────────────────────────────────────
  const { aiEnabled, aiLoading, aiResults, aiAmbiguity, aiError, toggleAi, aiSearch } = useAISearch();

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  // AI search: debounce when aiEnabled
  useEffect(() => {
    if (!aiEnabled) return;
    const timer = setTimeout(() => aiSearch(searchQuery), 350);
    return () => clearTimeout(timer);
  }, [searchQuery, aiEnabled, aiSearch]);

  // When AI returns guest results, merge for display
  const aiGuestResults = aiEnabled && aiResults?.table === 'guests' ? aiResults.results : null;

  const [newGuest, setNewGuest] = useState({
    name: '',
    phone: '',
    idCard: '',
    status: 'ACTIVE'
  });

  const [formErrors, setFormErrors] = useState({
    phone: '',
    idCard: ''
  });

  const validatePhone = (phone: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone) return '请输入手机号码';
    if (!phoneRegex.test(phone)) return '手机号格式不正确 (需为11位数字)';
    return '';
  };

  const validateIdCard = (idCard: string) => {
    const idCardRegex = /(^\d{15}$)|(^\d{18}$)|(^\d{17}(\d|X|x)$)/;
    if (!idCard) return '请输入身份证号';
    if (!idCardRegex.test(idCard)) return '身份证号格式不正确';
    return '';
  };

  const filteredGuests = guests.filter(guest => 
    guest.name.includes(searchQuery) || 
    guest.phone.includes(searchQuery) || 
    guest.idCard.includes(searchQuery)
  );

  // AI-enhanced display: when AI mode active, show only AI-matched guests
  const displayGuests = aiGuestResults
    ? guests.filter(g => aiGuestResults.some((ag: any) => ag.id === g.id))
    : filteredGuests;

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const phoneError = validatePhone(newGuest.phone);
    const idCardError = validateIdCard(newGuest.idCard);

    if (phoneError || idCardError) {
      setFormErrors({ phone: phoneError, idCard: idCardError });
      return;
    }

    await addGuest(newGuest);
    setIsModalOpen(false);
    setNewGuest({ name: '', phone: '', idCard: '', status: 'ACTIVE' });
    setFormErrors({ phone: '', idCard: '' });
  };

  const handleEditClick = (guest: any) => {
    setPendingAction(() => () => {
      setEditingGuest({ ...guest });
      setFormErrors({ phone: '', idCard: '' });
      setIsEditModalOpen(true);
    });
    setIsVerifyOpen(true);
  };

  const handleUpdateGuest = async (e: React.FormEvent) => {
    e.preventDefault();

    const phoneError = validatePhone(editingGuest.phone);
    const idCardError = validateIdCard(editingGuest.idCard);

    if (phoneError || idCardError) {
      setFormErrors({ phone: phoneError, idCard: idCardError });
      return;
    }

    await updateGuest(editingGuest);
    setIsEditModalOpen(false);
    setEditingGuest(null);
    setFormErrors({ phone: '', idCard: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">住客管理</h1>
          <p className="text-gray-500">查看并管理酒店所有住客的信息及历史记录。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <UserPlus className="w-5 h-5" />
          新增住客
        </button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={aiEnabled ? "AI模式: 试试「张伟」「姓张的客人」..." : "搜索姓名、电话或身份证号..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <AISearchToggle enabled={aiEnabled} onToggle={toggleAi} loading={aiLoading} />
      </div>

      {/* AI: 歧义提示 */}
      {aiAmbiguity && aiAmbiguity.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          🤔 你的搜索可能匹配多个类型：{aiAmbiguity.map((a: any) => a.label).join(' / ')}，请细化关键词。
        </div>
      )}

      {/* AI: 错误提示 */}
      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ❌ AI 搜索失败：{aiError}
        </div>
      )}

      {/* AI: 搜索结果提示 */}
      {aiEnabled && aiResults && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-2 text-xs text-purple-600 font-medium flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          AI 识别意图：{aiResults.intent_display || aiResults.matched_category || '未知'}，找到 {aiResults.count || aiResults.results?.length || 0} 条结果
        </div>
      )}

      {/* AI: 搜索中提示 */}
      {aiEnabled && aiLoading && (
        <div className="flex items-center justify-center gap-2 py-4 text-purple-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">AI 正在理解你的搜索...</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayGuests.map((guest) => (
          <div key={guest.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group">
            <button 
              onClick={() => handleEditClick(guest)}
              className="absolute top-6 right-6 p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="编辑住客"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold border-2 border-white shadow-sm">
                {guest.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">{guest.name}</h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                  实名认证
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Phone className="w-4 h-4 text-gray-400" />
                <span>{guest.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <IdCard className="w-4 h-4 text-gray-400" />
                <span>{guest.idCard}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {displayGuests.length === 0 && (
        <div className="p-12 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
          {aiEnabled ? 'AI 搜索无结果，试试其他关键词' : '未找到匹配的住客记录'}
        </div>
      )}

      {/* Add Guest Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">新增住客</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddGuest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住客姓名</label>
                <input 
                  required
                  type="text" 
                  value={newGuest.name}
                  onChange={(e) => setNewGuest({...newGuest, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号码</label>
                <input 
                  required
                  type="tel" 
                  value={newGuest.phone}
                  onChange={(e) => {
                    setNewGuest({...newGuest, phone: e.target.value});
                    if (formErrors.phone) setFormErrors({...formErrors, phone: ''});
                  }}
                  className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 transition-all ${
                    formErrors.phone ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                />
                {formErrors.phone && <p className="mt-1 text-xs text-red-500">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身份证号</label>
                <input 
                  required
                  type="text" 
                  value={newGuest.idCard}
                  onChange={(e) => {
                    setNewGuest({...newGuest, idCard: e.target.value});
                    if (formErrors.idCard) setFormErrors({...formErrors, idCard: ''});
                  }}
                  className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 transition-all ${
                    formErrors.idCard ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                />
                {formErrors.idCard && <p className="mt-1 text-xs text-red-500">{formErrors.idCard}</p>}
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm"
                >
                  保存住客
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Guest Modal */}
      {isEditModalOpen && editingGuest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">编辑住客</h2>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={async () => {
                    if (window.confirm('确定要删除这位住客吗？')) {
                      await deleteGuest(editingGuest.id);
                      setIsEditModalOpen(false);
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除住客"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateGuest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住客姓名</label>
                <input 
                  required
                  type="text" 
                  value={editingGuest.name}
                  onChange={(e) => setEditingGuest({...editingGuest, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">手机号码</label>
                <input 
                  required
                  type="tel" 
                  value={editingGuest.phone}
                  onChange={(e) => {
                    setEditingGuest({...editingGuest, phone: e.target.value});
                    if (formErrors.phone) setFormErrors({...formErrors, phone: ''});
                  }}
                  className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 transition-all ${
                    formErrors.phone ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                />
                {formErrors.phone && <p className="mt-1 text-xs text-red-500">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">身份证号</label>
                <input 
                  required
                  type="text" 
                  value={editingGuest.idCard}
                  onChange={(e) => {
                    setEditingGuest({...editingGuest, idCard: e.target.value});
                    if (formErrors.idCard) setFormErrors({...formErrors, idCard: ''});
                  }}
                  className={`w-full px-4 py-2 rounded-lg border outline-none focus:ring-2 transition-all ${
                    formErrors.idCard ? 'border-red-500 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                />
                {formErrors.idCard && <p className="mt-1 text-xs text-red-500">{formErrors.idCard}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">住客状态</label>
                <select 
                  value={editingGuest.status}
                  onChange={(e) => setEditingGuest({...editingGuest, status: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="ACTIVE">活跃住客</option>
                  <option value="INACTIVE">非活跃</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-sm"
                >
                  确认修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PasswordVerifyModal 
        isOpen={isVerifyOpen}
        onClose={() => setIsVerifyOpen(false)}
        onSuccess={pendingAction}
        title="编辑住客验证"
      />
    </div>
  );
};

export default Guests;
