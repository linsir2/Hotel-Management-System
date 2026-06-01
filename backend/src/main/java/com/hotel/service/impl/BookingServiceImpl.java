package com.hotel.service.impl;

import com.hotel.dao.BookingDao;
import com.hotel.dao.GuestDao;
import com.hotel.dao.RoomDao;
import com.hotel.entity.Booking;
import com.hotel.entity.Guest;
import com.hotel.entity.Room;
import com.hotel.service.BookingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class BookingServiceImpl implements BookingService {

    @Autowired
    private BookingDao bookingDao;

    @Autowired
    private RoomDao roomDao;

    @Autowired
    private GuestDao guestDao;

    @Override
    @Transactional
    public void createBooking(Booking booking) {
        // Map roomNumber to roomId
        if (booking.getRoomId() == null && booking.getRoomNumber() != null) {
            Room room = roomDao.getRoomByNumber(booking.getRoomNumber());
            if (room != null) {
                booking.setRoomId(room.getId());
            }
        }

        // Map guestName to guestId
        if (booking.getGuestId() == null && booking.getGuestName() != null) {
            Guest guest = guestDao.getGuestByName(booking.getGuestName());
            if (guest != null) {
                booking.setGuestId(guest.getId());
            } else {
                // If guest doesn't exist, create a temporary one or handle error
                // For simplicity, we create one if it's a new name
                Guest newGuest = new Guest();
                newGuest.setName(booking.getGuestName());
                newGuest.setIdCard("PENDING_" + System.currentTimeMillis()); // Temporary ID Card
                guestDao.createGuest(newGuest);
                booking.setGuestId(newGuest.getId());
            }
        }

        bookingDao.createBooking(booking);
        // Update room status to occupied
        roomDao.updateRoomStatus(booking.getRoomId(), "OCCUPIED");
    }

    @Override
    public List<Booking> getAllBookings() {
        return bookingDao.getAllBookings();
    }

    @Override
    @Transactional
    public void updateBooking(Booking booking) {
        // Map roomNumber to roomId if changed
        if (booking.getRoomNumber() != null) {
            Room room = roomDao.getRoomByNumber(booking.getRoomNumber());
            if (room != null) {
                booking.setRoomId(room.getId());
            }
        }

        // Map guestName to guestId if changed
        if (booking.getGuestName() != null) {
            Guest guest = guestDao.getGuestByName(booking.getGuestName());
            if (guest != null) {
                booking.setGuestId(guest.getId());
            } else {
                // Create new guest if name is new
                Guest newGuest = new Guest();
                newGuest.setName(booking.getGuestName());
                newGuest.setIdCard("PENDING_" + System.currentTimeMillis());
                guestDao.createGuest(newGuest);
                booking.setGuestId(newGuest.getId());
            }
        }
        
        bookingDao.updateBooking(booking);

        // 联动逻辑：根据订单状态自动调整房间状态
        if (booking.getRoomId() != null) {
            if ("CONFIRMED".equals(booking.getStatus())) {
                // 如果订单变为“入住中”，房间设为“OCCUPIED”
                roomDao.updateRoomStatus(booking.getRoomId(), "OCCUPIED");
            } else if ("COMPLETED".equals(booking.getStatus()) || "CANCELLED".equals(booking.getStatus())) {
                // 如果订单变为“已退房”或“已取消”，房间设为“AVAILABLE”
                roomDao.updateRoomStatus(booking.getRoomId(), "AVAILABLE");
            }
        }
    }

    @Override
    public void deleteBooking(Integer id) {
        bookingDao.deleteBooking(id);
    }
}
