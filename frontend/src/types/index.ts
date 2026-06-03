export interface Room {
  id: number;
  roomNumber: string;
  type: string;
  price: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';
}

export interface Guest {
  id?: number;
  name: string;
  idCard: string;
  phone: string;
}

export interface Booking {
  id?: number;
  roomId: number;
  guestId?: number;
  checkIn: string;
  checkOut: string;
  status: string;
  totalAmount: number;
  room?: Room;
  guest?: Guest;
  // Aliased fields from joined queries (backend may return these)
  guestName?: string;
  roomNumber?: string;
}
