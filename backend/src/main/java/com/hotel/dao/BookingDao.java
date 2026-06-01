package com.hotel.dao;

import com.hotel.entity.Booking;
import java.util.List;

public interface BookingDao {
    void createBooking(Booking booking);
    List<Booking> getAllBookings();
    Booking getBookingById(Integer id);
    void updateBooking(Booking booking);
    void deleteBooking(Integer id);
}
