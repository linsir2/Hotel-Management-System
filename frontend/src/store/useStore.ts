import { create } from 'zustand';
import { Room, Booking, Guest } from '../types';

interface HotelStore {
  user: any | null;
  rooms: Room[];
  bookings: Booking[];
  guests: Guest[];
  setUser: (user: any | null) => void;
  setRooms: (rooms: Room[]) => void;
  setBookings: (bookings: Booking[]) => void;
  setGuests: (guests: Guest[]) => void;
  updateRoomStatus: (roomId: number, status: Room['status']) => void;
  fetchRooms: () => Promise<void>;
  fetchBookings: () => Promise<void>;
  fetchGuests: () => Promise<void>;
  addRoom: (room: Partial<Room>) => Promise<void>;
  updateRoom: (room: Room) => Promise<void>;
  addBooking: (booking: any) => Promise<void>;
  updateBooking: (booking: any) => Promise<void>;
  addGuest: (guest: any) => Promise<void>;
  updateGuest: (guest: any) => Promise<void>;
  deleteRoom: (id: number) => Promise<void>;
  deleteBooking: (id: number) => Promise<void>;
  deleteGuest: (id: number) => Promise<void>;
  login: (credentials: any) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  verifyPassword: (password: string) => Promise<{ success: boolean; message?: string }>;
}

export const useStore = create<HotelStore>((set, get) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  rooms: [],
  bookings: [],
  guests: [],
  setUser: (user) => {
    if (user) localStorage.setItem('user', JSON.stringify(user));
    else localStorage.removeItem('user');
    set({ user });
  },
  setRooms: (rooms) => set({ rooms }),
  setBookings: (bookings) => set({ bookings }),
  setGuests: (guests) => set({ guests }),
  updateRoomStatus: (roomId, status) =>
    set((state) => ({
      rooms: state.rooms.map((room) =>
        room.id === roomId ? { ...room, status } : room
      ),
    })),
  fetchRooms: async () => {
    try {
      const response = await fetch('/api/rooms');
      const data = await response.json();
      set({ rooms: data });
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  },
  fetchBookings: async () => {
    try {
      const response = await fetch('/api/bookings');
      const data = await response.json();
      set({ bookings: data });
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  },
  fetchGuests: async () => {
    try {
      const response = await fetch('/api/guests');
      const data = await response.json();
      set({ guests: data });
    } catch (error) {
      console.error('Failed to fetch guests:', error);
    }
  },
  addRoom: async (room) => {
    try {
      await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(room),
      });
      get().fetchRooms();
    } catch (error) {
      console.error('Failed to add room:', error);
    }
  },
  updateRoom: async (room) => {
    try {
      await fetch(`/api/rooms/${room.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(room),
      });
      get().fetchRooms();
    } catch (error) {
      console.error('Failed to update room:', error);
    }
  },
  addBooking: async (booking) => {
    try {
      await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });
      get().fetchBookings();
    } catch (error) {
      console.error('Failed to add booking:', error);
    }
  },
  updateBooking: async (booking) => {
    try {
      await fetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(booking),
      });
      get().fetchBookings();
      get().fetchRooms(); // 联动更新：预订状态改变可能影响房态
    } catch (error) {
      console.error('Failed to update booking:', error);
    }
  },
  addGuest: async (guest) => {
    try {
      await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guest),
      });
      get().fetchGuests();
    } catch (error) {
      console.error('Failed to add guest:', error);
    }
  },
  updateGuest: async (guest) => {
    try {
      await fetch(`/api/guests/${guest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guest),
      });
      get().fetchGuests();
    } catch (error) {
      console.error('Failed to update guest:', error);
    }
  },
  deleteRoom: async (id) => {
    try {
      await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
      get().fetchRooms();
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  },
  deleteBooking: async (id) => {
    try {
      await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      get().fetchBookings();
    } catch (error) {
      console.error('Failed to delete booking:', error);
    }
  },
  deleteGuest: async (id) => {
    try {
      await fetch(`/api/guests/${id}`, { method: 'DELETE' });
      get().fetchGuests();
    } catch (error) {
      console.error('Failed to delete guest:', error);
    }
  },
  login: async (credentials) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      const data = await response.json();
      if (data.success) {
        get().setUser(data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      get().setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
  checkAuth: async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (data.authenticated) {
        get().setUser(data.user);
      } else {
        get().setUser(null);
      }
    } catch (error) {
      console.error('Check auth error:', error);
    }
  },
  verifyPassword: async (password) => {
    try {
      const response = await fetch('/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      return data; // 返回整个对象 { success: boolean, message?: string }
    } catch (error) {
      console.error('Verify password error:', error);
      return { success: false, message: '服务器连接失败' };
    }
  },
}));
