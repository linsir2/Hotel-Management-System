import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Calendar,
  MoreVertical,
  CheckCircle2,
  Clock,
  XCircle,
  Plus, 
  X,
  Trash2,
  Users
} from 'lucide-react';
import { useStore } from '../store/useStore';
import PasswordVerifyModal from '../components/PasswordVerifyModal';

const Bookings = () => {
  const { 
    bookings, fetchBookings, addBooking, updateBooking, deleteBooking, 
    rooms, fetchRooms,
    guests, fetchGuests 
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [dateError, setDateError] = useState('');
  
  // Guest selection state
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');

  // Verification states
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<() => void>(() => {});
  
  useEffect(() => {
    fetchBookings();
    fetchRooms();
    fetchGuests();
  }, [fetchBookings, fetchRooms, fetchGuests]);

  const validateDates = (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut) return '';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    if (end < start) {
      return '退房日期不能早于入住日期';
    }
    return '';
  };

  const [newBooking, setNewBooking] = useState({
    guestName: '',
    roomNumber: '',
    checkIn: '',
    checkOut: '',
    status: 'PENDING',
    totalAmount: 0
  });

  const statusMap: any = {
    CONFIRMED: { label: '入住中', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
    PENDING: { label: '待处理', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: Clock },
    COMPLETED: { label: '已退房', color: 'text-gray-600 bg-gray-50 border-gray-100', icon: CheckCircle2 },
    CANCELLED: { label: '已取消', color: 'text-red-600 bg-red-50 border-red-100', icon: XCircle },
  };

  const filteredBookings = bookings.filter(booking => {
    const guestName = booking.guestName || booking.guest?.name || '';
    const roomNumber = booking.roomNumber || booking.room?.roomNumber || '';
    const matchesSearch = guestName.includes(searchQuery) || roomNumber.includes(searchQuery);
    const matchesFilter = filterStatus === 'ALL' || booking.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const handleAddBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateDates(newBooking.checkIn, newBooking.checkOut);
    if (error) {
      setDateError(error);
      return;
    }
    await addBooking(newBooking);
    setIsModalOpen(false);
    setNewBooking({ guestName: '', roomNumber: '', checkIn: '', checkOut: '', status: 'PENDING', totalAmount: 0 });
    setDateError('');
  };

  const handleEditClick = (booking: any) => {
    setPendingAction(() => () => {
      // Format dates for the input[type="date"]
      const formattedBooking = {
        ...booking,
        checkIn: booking.checkIn ? new Date(booking.checkIn).toISOString().split('T')[0] : '',
        checkOut: booking.checkOut ? new Date(booking.checkOut).toISOString().split('T')[0] : ''
      };
      setEditingBooking(formattedBooking);
      setDateError('');
      setIsEditModalOpen(true);
    });
    setIsVerifyOpen(true);
  };

  const handleUpdateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateDates(editingBooking.checkIn, editingBooking.checkOut);
    if (error) {
      setDateError(error);
      return;
    }
    await updateBooking(editingBooking);
    setIsEditModalOpen(false);
    setEditingBooking(null);
    setDateError('');
  };

  const renderGuestName = (booking: any) => {
    return booking.guestName || booking.guest?.name || '未知住客';
  };

  const renderRoomInfo = (booking: any) => {
    return {
      number: booking.roomNumber || booking.room?.roomNumber || 'N/A',
      type: booking.roomType || booking.room?.type || '标准间'
    };
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    const date = new Date(dateValue);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">预订管理</h1>
          <p className="text-gray-500">管理酒店所有的客户预订和订单状态。</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          新增预订
        </button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="搜索预订人、房间号..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-50 border border-gray-200 text-gray-600 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 outline-none"
          >
            <option value="ALL">全部状态</option>
            <option value="PENDING">待处理</option>
            <option value="CONFIRMED">入住中</option>
            <option value="COMPLETED">已退房</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">住客姓名</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">房间信息</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">入住/退房日期</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">订单金额</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600">状态</th>
              <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredBookings.map((booking) => {
              const status = statusMap[booking.status];
              const StatusIcon = status.icon;
              return (
                <tr key={booking.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                        {renderGuestName(booking).charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{renderGuestName(booking)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{renderRoomInfo(booking).number} 房间</p>
                      <p className="text-gray-500">{renderRoomInfo(booking).type}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(booking.checkIn)}</span>
                      <span>至</span>
                      <span>{formatDate(booking.checkOut)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-blue-600">
                    ¥ {booking.totalAmount}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${status.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleEditClick(booking)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="编辑预订"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredBookings.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            未找到匹配的预订记录
          </div>
        )}
      </div>

      {/* Add Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">新增预订</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddBooking} className="p-6 space-y-4">
              {dateError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center">
                  {dateError}
                </div>
              )}
              <div className="relative">
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">住客姓名</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowGuestPicker(!showGuestPicker);
                      setGuestSearch('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" />
                    {showGuestPicker ? '关闭选择' : '选择已有住客'}
                  </button>
                </div>
                <input 
                  required
                  type="text" 
                  value={newBooking.guestName}
                  onChange={(e) => {
                    setNewBooking({...newBooking, guestName: e.target.value});
                    if (showGuestPicker) setShowGuestPicker(false);
                  }}
                  placeholder="手动输入或从右侧选择"
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                />

                {showGuestPicker && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                      <input 
                        autoFocus
                        type="text"
                        placeholder="搜索姓名、电话..."
                        value={guestSearch}
                        onChange={(e) => setGuestSearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {(guests || [])
                        .filter(g => (g.name || '').includes(guestSearch) || (g.phone || '').includes(guestSearch))
                        .map(guest => (
                          <button
                            key={guest.id}
                            type="button"
                            onClick={() => {
                              setNewBooking({...newBooking, guestName: guest.name});
                              setShowGuestPicker(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600">{guest.name}</p>
                              <p className="text-xs text-gray-500">{guest.phone}</p>
                            </div>
                            <Plus className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                          </button>
                        ))
                      }
                      {(guests || []).filter(g => (g.name || '').includes(guestSearch) || (g.phone || '').includes(guestSearch)).length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400">未找到匹配住客</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">房间号</label>
                  <select 
                    required
                    value={newBooking.roomNumber}
                    onChange={(e) => {
                      const selectedRoom = rooms.find(r => r.roomNumber === e.target.value);
                      setNewBooking({
                        ...newBooking, 
                        roomNumber: e.target.value,
                        totalAmount: selectedRoom ? selectedRoom.price : 0
                      });
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">选择房间</option>
                    {rooms
                      .filter(room => room.status === 'AVAILABLE')
                      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
                      .map(room => (
                        <option key={room.id} value={room.roomNumber}>
                          {room.roomNumber} ({room.type} - ¥{room.price})
                        </option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
                  <input 
                    readOnly
                    type="number" 
                    value={newBooking.totalAmount}
                    className="w-full px-4 py-2 rounded-lg border border-gray-100 bg-gray-50 text-gray-500 outline-none cursor-not-allowed"
                    title="金额根据选择的房间自动填充"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入住日期</label>
                  <input 
                    required
                    type="date" 
                    value={newBooking.checkIn}
                    onChange={(e) => setNewBooking({...newBooking, checkIn: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">退房日期</label>
                  <input 
                    required
                    type="date" 
                    value={newBooking.checkOut}
                    onChange={(e) => setNewBooking({...newBooking, checkOut: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
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
                  保存预订
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Booking Modal */}
      {isEditModalOpen && editingBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-900">编辑预订</h2>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={async () => {
                    if (window.confirm('确定要删除这条预订记录吗？')) {
                      await deleteBooking(editingBooking.id);
                      setIsEditModalOpen(false);
                    }
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="删除预订"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <form onSubmit={handleUpdateBooking} className="p-6 space-y-4">
              {dateError && (
                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100 text-center">
                  {dateError}
                </div>
              )}
              <div className="relative">
                <div className="flex justify-between items-end mb-1">
                  <label className="block text-sm font-medium text-gray-700">住客姓名</label>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowGuestPicker(!showGuestPicker);
                      setGuestSearch('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Users className="w-3 h-3" />
                    {showGuestPicker ? '关闭选择' : '选择已有住客'}
                  </button>
                </div>
                <input 
                  required
                  type="text" 
                  value={editingBooking.guestName || (editingBooking.guest?.name || '')}
                  onChange={(e) => {
                    setEditingBooking({...editingBooking, guestName: e.target.value});
                    if (showGuestPicker) setShowGuestPicker(false);
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                />

                {showGuestPicker && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-gray-50 bg-gray-50/50">
                      <input 
                        autoFocus
                        type="text"
                        placeholder="搜索姓名、电话..."
                        value={guestSearch}
                        onChange={(e) => setGuestSearch(e.target.value)}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {(guests || [])
                        .filter(g => (g.name || '').includes(guestSearch) || (g.phone || '').includes(guestSearch))
                        .map(guest => (
                          <button
                            key={guest.id}
                            type="button"
                            onClick={() => {
                              setEditingBooking({...editingBooking, guestName: guest.name});
                              setShowGuestPicker(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-center justify-between group"
                          >
                            <div>
                              <p className="text-sm font-bold text-gray-900 group-hover:text-blue-600">{guest.name}</p>
                              <p className="text-xs text-gray-500">{guest.phone}</p>
                            </div>
                            <Plus className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                          </button>
                        ))
                      }
                      {(guests || []).filter(g => (g.name || '').includes(guestSearch) || (g.phone || '').includes(guestSearch)).length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400">未找到匹配住客</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">房间号</label>
                  <select 
                    required
                    value={editingBooking.roomNumber || (editingBooking.room?.roomNumber || '')}
                    onChange={(e) => {
                      const selectedRoom = rooms.find(r => r.roomNumber === e.target.value);
                      setEditingBooking({
                        ...editingBooking, 
                        roomNumber: e.target.value,
                        totalAmount: selectedRoom ? selectedRoom.price : editingBooking.totalAmount
                      });
                    }}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">选择房间</option>
                    {rooms
                      .filter(room => 
                        room.status === 'AVAILABLE' || 
                        room.roomNumber === (editingBooking.roomNumber || editingBooking.room?.roomNumber)
                      )
                      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }))
                      .map(room => (
                        <option key={room.id} value={room.roomNumber}>
                          {room.roomNumber} ({room.type} - ¥{room.price})
                        </option>
                      ))
                    }
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">金额</label>
                  <input 
                    readOnly
                    type="number" 
                    value={editingBooking.totalAmount}
                    className="w-full px-4 py-2 rounded-lg border border-gray-100 bg-gray-50 text-gray-500 outline-none cursor-not-allowed"
                    title="金额根据选择的房间自动填充"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">入住日期</label>
                  <input 
                    required
                    type="date" 
                    value={editingBooking.checkIn}
                    onChange={(e) => setEditingBooking({...editingBooking, checkIn: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">退房日期</label>
                  <input 
                    required
                    type="date" 
                    value={editingBooking.checkOut}
                    onChange={(e) => setEditingBooking({...editingBooking, checkOut: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">订单状态</label>
                <select 
                  value={editingBooking.status}
                  onChange={(e) => setEditingBooking({...editingBooking, status: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="PENDING">待处理</option>
                  <option value="CONFIRMED">入住中</option>
                  <option value="COMPLETED">已退房</option>
                  <option value="CANCELLED">已取消</option>
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
        title="编辑预订验证"
      />
    </div>
  );
};

export default Bookings;
