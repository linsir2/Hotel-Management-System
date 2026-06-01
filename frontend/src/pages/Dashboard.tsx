import React, { useEffect } from 'react';
import { 
  Users, 
  BedDouble, 
  TrendingUp, 
  Clock 
} from 'lucide-react';
import { useStore } from '../store/useStore';

const StatCard = ({ icon: Icon, label, value, color }: any) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
    <div className={`p-4 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div>
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
    </div>
  </div>
);

const Dashboard = () => {
  const { rooms, bookings, fetchRooms, fetchBookings } = useStore();

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, [fetchRooms, fetchBookings]);

  const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED').length;
  const totalRooms = rooms.length;
  const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
  const totalRevenue = bookings
    .filter(b => b.status === 'COMPLETED' || b.status === 'CONFIRMED')
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const statusMap: any = {
    CONFIRMED: { label: '入住中', color: 'bg-emerald-50 text-emerald-600' },
    PENDING: { label: '待处理', color: 'bg-blue-50 text-blue-600' },
    COMPLETED: { label: '已退房', color: 'bg-gray-50 text-gray-500' },
    CANCELLED: { label: '已取消', color: 'bg-red-50 text-red-600' },
  };

  const recentBookings = [...bookings].reverse().slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据概览</h1>
        <p className="text-gray-500">欢迎回来，以下是今日的运营状况。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={BedDouble} 
          label="已入住" 
          value={`${occupiedRooms} / ${totalRooms}`} 
          color="bg-blue-600" 
        />
        <StatCard 
          icon={Users} 
          label="待处理预订" 
          value={pendingBookings} 
          color="bg-emerald-500" 
        />
        <StatCard 
          icon={TrendingUp} 
          label="累计营收" 
          value={`¥ ${totalRevenue.toLocaleString()}`} 
          color="bg-violet-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4">最近订单</h3>
          <div className="space-y-4">
            {recentBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    {(booking.guest?.name || '客').charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium">{booking.guest?.name || booking.guestName || '未知住客'}</p>
                    <p className="text-xs text-gray-500">{booking.room?.roomNumber || booking.roomNumber} {booking.room?.type || ''}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                  statusMap[booking.status]?.color || 'bg-gray-50 text-gray-500'
                }`}>
                  {statusMap[booking.status]?.label || '未知'}
                </span>
              </div>
            ))}
            {recentBookings.length === 0 && (
              <div className="text-center text-gray-500 py-8">暂无数据</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-4">客房状态分布</h3>
          <div className="flex items-center justify-around h-48">
             <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-32 bg-blue-100 rounded-t-lg relative overflow-hidden">
                 <div className="absolute bottom-0 w-full bg-blue-600" style={{ height: `${(rooms.filter(r => r.status === 'AVAILABLE').length / (totalRooms || 1)) * 100}%` }}></div>
               </div>
               <span className="text-xs font-medium">空闲 ({rooms.filter(r => r.status === 'AVAILABLE').length})</span>
             </div>
             <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-32 bg-emerald-100 rounded-t-lg relative overflow-hidden">
                 <div className="absolute bottom-0 w-full bg-emerald-500" style={{ height: `${(rooms.filter(r => r.status === 'OCCUPIED').length / (totalRooms || 1)) * 100}%` }}></div>
               </div>
               <span className="text-xs font-medium">占用 ({rooms.filter(r => r.status === 'OCCUPIED').length})</span>
             </div>
             <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-32 bg-orange-100 rounded-t-lg relative overflow-hidden">
                 <div className="absolute bottom-0 w-full bg-orange-400" style={{ height: `${(rooms.filter(r => r.status === 'MAINTENANCE').length / (totalRooms || 1)) * 100}%` }}></div>
               </div>
               <span className="text-xs font-medium">维修 ({rooms.filter(r => r.status === 'MAINTENANCE').length})</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
